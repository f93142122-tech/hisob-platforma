import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { D, fmtDate, fmtDateTime, fmtMoney, fmtQty, parseMoney, uuid } from '../lib/money';
import { submitOp } from '../lib/ops';
import { Empty, Field, Modal, Money, MoneyInput, Tabs, payLabel, useToast } from '../lib/ui';
import { TopBar } from '../App';

export function Debts() {
  const { t } = useT();
  const [status, setStatus] = useState<'open' | 'closed' | 'all'>('open');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['debts', status, q],
    queryFn: () => api<any[]>(`/api/debts?status=${status}&q=${encodeURIComponent(q)}`),
  });
  const rows = list.data ?? [];
  const totalRemaining = rows.reduce((s, d) => s.plus(d.remaining), D(0));

  return (
    <>
      <TopBar title={t('Nasiya savdolar')} />
      <div className="page">
        {list.isError && <div className="alert alert-warn">{t('Ma’lumotni yuklab bo‘lmadi. Internet aloqasini tekshiring.')}</div>}
        <div className="card">
          <div className="card-head">
            <div className="row">
              <Tabs value={status} onChange={setStatus} items={[{ value: 'open', label: t('Ochiq') }, { value: 'closed', label: t('Yopilgan') }, { value: 'all', label: t('Barchasi') }]} />
              <div className="search" style={{ width: 300 }}><Search size={16} />
                <input className="input" placeholder={t('Xaridor ismi yoki telefoni')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
            </div>
            <div>{t('Qolgan qarz jami')}: <b className="num neg">{fmtMoney(totalRemaining)}</b></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>{t('Sana')}</th><th>{t('Xaridor')}</th><th>{t('Telefon')}</th><th>{t('Sotilgan mahsulotlar')}</th>
                <th className="r">{t('Umumiy qarz')}</th><th className="r">{t('To‘langan')}</th><th className="r">{t('Qolgan qarz')}</th><th>{t('Izoh')}</th>
              </tr></thead>
              <tbody>{rows.map((d) => (
                <tr key={d.id} className="clickable" onClick={() => setOpenId(d.id)}>
                  <td>{fmtDate(d.createdAt)}<div className="small muted">№{d.saleNumber}</div></td>
                  <td><b>{d.customerName}</b></td><td>{d.customerPhone ?? '—'}</td>
                  <td className="small" style={{ maxWidth: 260 }}>{d.products}</td>
                  <td className="r"><Money v={d.amount} /></td>
                  <td className="r"><Money v={D(d.paid).plus(d.reduced ?? 0).toFixed(2)} /></td>
                  <td className="r">{D(d.remaining).gt(0) ? <Money v={d.remaining} className="neg" /> : <span className="tag tag-ok">{t('To‘langan')}</span>}</td>
                  <td className="small">{d.note}</td>
                </tr>
              ))}</tbody>
            </table>
            {list.isSuccess && !rows.length && <Empty text={t('Nasiya yo‘q')} />}
          </div>
        </div>
      </div>
      {openId && <DebtModal id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function DebtModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const q = useQuery({ queryKey: ['debt', id], queryFn: () => api<any>(`/api/debts/${id}`) });
  const d = q.data;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'card' | 'click'>('cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    const a = parseMoney(amount);
    if (!a || D(a).lte(0)) return toast('error', t('Summani kiriting'));
    if (D(a).gt(d.remaining)) return toast('error', t('To‘lov qolgan qarzdan ko‘p bo‘lishi mumkin emas'));
    setBusy(true);
    const r = await submitOp('debtPayment.create', { id: uuid(), debtId: id, amount: a, method, note: note.trim() || null });
    setBusy(false);
    if (r.status === 'error') return toast('error', r.error!);
    toast('ok', t('To‘lov qabul qilindi'));
    setAmount(''); setNote('');
  };

  return (
    <Modal title={t('Nasiya')} onClose={onClose} wide>
      {!d ? <div className="muted">{t('Yuklanmoqda...')}</div> : (
        <>
          <div className="grid grid-4">
            <div><div className="muted small">{t('Xaridor')}</div><b>{d.customerName}</b><div className="small">{d.customerPhone ?? ''}</div></div>
            <div><div className="muted small">{t('Umumiy qarz')}</div><b className="num">{fmtMoney(d.amount)}</b></div>
            <div><div className="muted small">{t('To‘langan')}</div><b className="num pos">{fmtMoney(D(d.paid).plus(d.reduced ?? 0))}</b>{D(d.reduced ?? 0).gt(0) && <div className="small muted">{t('shundan qaytarish hisobiga')}: {fmtMoney(d.reduced)}</div>}</div>
            <div><div className="muted small">{t('Qolgan qarz')}</div><b className="num neg" style={{ fontSize: 18 }}>{fmtMoney(d.remaining)}</b></div>
          </div>
          {d.note && <div className="alert alert-info">{d.note}</div>}
          {d.sale && (
            <table>
              <thead><tr><th>{t('Mahsulot')}</th><th className="r">{t('Soni')}</th><th className="r">{t('Narx')}</th><th className="r">{t('Jami')}</th></tr></thead>
              <tbody>{d.sale.items.map((i: any) => (
                <tr key={i.id}><td>{i.productName}{D(i.returnedQty).gt(0) && <span className="tag tag-warn" style={{ marginLeft: 6 }}>{t('qaytarilgan')}: {fmtQty(i.returnedQty)} {t(i.unitName)}</span>}</td>
                  <td className="r">{fmtQty(i.qty)} {t(i.unitName)}</td><td className="r"><Money v={i.unitPrice} /></td><td className="r"><Money v={D(i.unitPrice).times(i.qty).toFixed(2)} /></td></tr>
              ))}</tbody>
            </table>
          )}
          {d.payments?.length > 0 && (
            <>
              <h3>{t('To‘lovlar tarixi')}</h3>
              <table><thead><tr><th>{t('Vaqt')}</th><th>{t('Usul')}</th><th>{t('Kim qabul qildi')}</th><th>{t('Izoh')}</th><th className="r">{t('Summa')}</th></tr></thead>
                <tbody>{d.payments.map((p: any) => (
                  <tr key={p.id}><td>{fmtDateTime(p.createdAt)}</td><td>{t(payLabel[p.method])}</td><td>{p.userName}</td><td className="small">{p.note}</td><td className="r"><Money v={p.amount} /></td></tr>
                ))}</tbody></table>
            </>
          )}
          {D(d.remaining).gt(0) && (
            <div className="card card-pad" style={{ background: '#fafbfc' }}>
              <h3 style={{ marginBottom: 10 }}>{t('To‘lov qabul qilish')}</h3>
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <Field label={t('Summa')}><MoneyInput value={amount} onChange={setAmount} autoFocus /></Field>
                <button className="btn btn-sm" onClick={() => setAmount(D(d.remaining).toFixed(2))}>{t('Hammasini')}</button>
                <Field label={t('Usul')}>
                  <select className="input" value={method} onChange={(e) => setMethod(e.target.value as any)}>
                    <option value="cash">{t('Naqd')}</option><option value="card">{t('Karta')}</option><option value="click">Click</option>
                  </select>
                </Field>
                <Field label={t('Izoh')}><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                <button className="btn btn-ok" disabled={busy} onClick={pay}>{t('Qabul qilish')}</button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
