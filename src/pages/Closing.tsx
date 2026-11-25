import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileDown, LockKeyhole, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { useAuth, isAdmin } from '../lib/auth';
import { D, fmtDate, fmtDateTime, fmtMoney, parseMoney, todayLocal } from '../lib/money';
import { downloadClosingPdf } from '../lib/pdf';
import { Confirm, Field, Modal, Money, MoneyInput, useToast } from '../lib/ui';
import { TopBar } from '../App';
import { ProductsTable, SummaryCards } from './SummaryView';

export function Closing() {
  const { t } = useT();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const today = todayLocal();
  const [date, setDate] = useState(today);
  const pv = useQuery({ queryKey: ['closing-preview', date], queryFn: () => api<any>(`/api/closings/preview?date=${date}`) });
  const history = useQuery({ queryKey: ['closings'], queryFn: () => api<any[]>('/api/closings') });
  const [opening, setOpening] = useState('');
  const [actual, setActual] = useState('');
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pv.data) {
      setOpening(D(pv.data.openingCash).toFixed(2).replace(/\.00$/, ''));
      setActual(pv.data.closing ? D(pv.data.closing.actualCash).toFixed(2).replace(/\.00$/, '') : '');
      setNote(pv.data.closing?.note ?? '');
    }
  }, [pv.data?.date, pv.data?.closing?.closedAt]);

  const s = pv.data?.summary;
  const expected = s ? D(parseMoney(opening) ?? 0).plus(s.netCashFlow) : D(0);
  const diff = actual === '' ? null : D(parseMoney(actual) ?? 0).minus(expected);
  const closed = pv.data?.closing;

  const pdf = async (closing: any) => {
    try {
      const exps = await api<any[]>(`/api/expenses?from=${closing.date}&to=${closing.date}`);
      await downloadClosingPdf(closing, exps, t);
    } catch (e: any) { toast('error', e.message); }
  };

  const close = async () => {
    const o = parseMoney(opening), a = parseMoney(actual);
    if (o === null) return toast('error', t('Kun boshidagi kassani kiriting'));
    if (a === null) return toast('error', t('Kassadagi haqiqiy pulni kiriting'));
    setBusy(true);
    try {
      const r = await api<any>('/api/closings', { method: 'POST', body: { date, openingCash: o, actualCash: a, note: note.trim() || null, overwrite: !!closed } });
      setAsk(false);
      setDone(r);
      qc.invalidateQueries({ queryKey: ['closings'] });
      qc.invalidateQueries({ queryKey: ['closing-preview'] });
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title={t('Kunlik ishni yakunlash')} />
      <div className="page">
        <div className="card card-pad row">
          <span>{t('Kun')}:</span>
          <input type="date" className="input" style={{ width: 170 }} max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          {closed && <span className="tag tag-ok"><LockKeyhole size={12} /> {t('Yopilgan')}: {closed.closedByName}, {fmtDateTime(closed.closedAt)}</span>}
          <span className="spacer" />
          {closed && <button className="btn" onClick={() => pdf(closed)}><FileDown size={16} /> {t('PDF yuklab olish')}</button>}
        </div>
        {pv.isError && <div className="alert alert-warn">{t('Ma’lumotni yuklab bo‘lmadi. Internet aloqasini tekshiring.')}</div>}
        {pv.data?.pendingRecurring > 0 && (
          <Link to="/doimiy-xarajatlar" className="alert alert-warn"><AlertTriangle size={16} />{t('{n} ta doimiy xarajat tasdiqlanmagan. Tasdiqlanmagan xarajat sof foydaga kirmaydi.', { n: pv.data.pendingRecurring })}</Link>
        )}
        {s && (
          <>
            <SummaryCards s={s} />
            <div className="card">
              <div className="card-head"><h2>{t('Kassa solishtiruvi')}</h2></div>
              <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14, alignItems: 'end' }}>
                <Field label={t('Kun boshidagi kassa')} hint={t('Oldingi yopilgan kundagi haqiqiy pul')}><MoneyInput value={opening} onChange={setOpening} /></Field>
                <div><div className="field-label">{t('+ Naqd tushum')}</div><div className="num" style={{ padding: '8px 0' }}>{fmtMoney(s.income.cash)}</div></div>
                <div><div className="field-label">{t('− Kassadan xarajatlar')}</div><div className="num" style={{ padding: '8px 0' }}>{fmtMoney(s.cashExpenses)}</div></div>
                <div><div className="field-label">{t('Tizim bo‘yicha kassa qoldig‘i')}</div><div className="num" style={{ padding: '8px 0', fontSize: 18, fontWeight: 700 }}>{fmtMoney(expected)}</div></div>
                <Field label={t('Kassadagi haqiqiy pul') + ' *'}><MoneyInput value={actual} onChange={setActual} /></Field>
              </div>
              <div className="card-pad" style={{ borderTop: '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                {diff !== null && (
                  <div className={`alert ${diff.isZero() ? 'alert-info' : diff.gt(0) ? 'alert-warn' : 'alert-danger'}`} style={{ fontSize: 15 }}>
                    {diff.isZero() ? t('Kassa to‘g‘ri — farq yo‘q') : diff.gt(0) ? t('Ortiqcha: {s} so‘m', { s: fmtMoney(diff) }) : t('Kamomad: {s} so‘m', { s: fmtMoney(diff.neg()) })}
                  </div>
                )}
                <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder={t('Izoh (ixtiyoriy)')} value={note} onChange={(e) => setNote(e.target.value)} />
                {!closed
                  ? <button className="btn btn-primary btn-lg" disabled={actual === ''} onClick={() => setAsk(true)}><LockKeyhole size={17} /> {t('Kunni yakunlash')}</button>
                  : isAdmin(user) && <button className="btn" disabled={actual === ''} onClick={() => setAsk(true)}>{t('Qayta yopish (yangilash)')}</button>}
              </div>
            </div>
            <ProductsTable s={s} />
          </>
        )}

        <div className="card">
          <div className="card-head"><h2>{t('Oldingi kunlar hisobotlari')}</h2></div>
          <table>
            <thead><tr><th>{t('Sana')}</th><th className="r">{t('Savdo')}</th><th className="r">{t('Sof foyda')}</th><th className="r">{t('Tizim bo‘yicha kassa')}</th><th className="r">{t('Haqiqiy')}</th><th className="r">{t('Farq')}</th><th>{t('Yopdi')}</th><th /></tr></thead>
            <tbody>{(history.data ?? []).map((c) => (
              <tr key={c.date}>
                <td><a href="#" onClick={(e) => { e.preventDefault(); setDate(c.date); window.scrollTo(0, 0); }}>{fmtDate(c.date)}</a></td>
                <td className="r"><Money v={c.netSales} /></td><td className="r"><Money v={c.netProfit} /></td>
                <td className="r"><Money v={c.expectedCash} /></td><td className="r"><Money v={c.actualCash} /></td>
                <td className={`r ${D(c.difference).lt(0) ? 'neg' : D(c.difference).gt(0) ? 'pos' : ''}`}>{D(c.difference).gt(0) ? '+' : ''}<Money v={c.difference} /></td>
                <td className="small">{c.closedByName}<div className="muted">{fmtDateTime(c.closedAt)}</div></td>
                <td><button className="icon-btn" title="PDF" onClick={async () => pdf(await api(`/api/closings/${c.date}`))}><FileDown size={16} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {ask && (
        <Confirm title={t('Kunni yakunlash')} confirmText={t('Yakunlash')} onClose={() => setAsk(false)} onConfirm={close}
          text={t('{d} kuni yakunlanadi va hisobot saqlanadi. Kassadagi haqiqiy pul: {a} so‘m.', { d: fmtDate(date), a: fmtMoney(parseMoney(actual) ?? 0) })} />
      )}
      {done && (
        <Modal title={t('Kun yakunlandi')} onClose={() => setDone(null)} footer={<>
          <button className="btn" onClick={() => setDone(null)}>{t('Yopish')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={async () => { await pdf(done); setDone(null); }}><FileDown size={16} /> {t('PDF hisobotni yuklab olish')}</button>
        </>}>
          <p>{t('{d} kuni uchun hisobot saqlandi.', { d: fmtDate(done.date) })}</p>
          <div className="grid grid-2">
            <div><div className="muted small">{t('Sof savdo')}</div><b className="num">{fmtMoney(done.summary.netSales)}</b></div>
            <div><div className="muted small">{t('Sof foyda')}</div><b className="num">{fmtMoney(done.summary.netProfit)}</b></div>
            <div><div className="muted small">{t('Tizim bo‘yicha kassa')}</div><b className="num">{fmtMoney(done.expectedCash)}</b></div>
            <div><div className="muted small">{t('Farq')}</div><b className={`num ${D(done.difference).lt(0) ? 'neg' : ''}`}>{fmtMoney(done.difference)}</b></div>
          </div>
          <p className="muted">{t('Bugungi savdo hisobotini PDF formatida yuklab olasizmi?')}</p>
        </Modal>
      )}
    </>
  );
}
