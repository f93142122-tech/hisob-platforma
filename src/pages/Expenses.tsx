import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { useAuth, isAdmin } from '../lib/auth';
import { D, fmtDate, fmtDateTime, fmtMoney, parseMoney, todayLocal, uuid } from '../lib/money';
import { submitOp } from '../lib/ops';
import { Confirm, Empty, Field, Money, MoneyInput, Tabs, useToast } from '../lib/ui';
import { TopBar } from '../App';

const CATEGORIES = ['Ovqat', 'Transport', 'Mahsulot olib kelish', 'Kommunal', 'Xo‘jalik', 'Boshqa'];

export function Expenses() {
  const { t } = useT();
  const { user } = useAuth();
  const toast = useToast();
  const today = todayLocal();
  const [f, setF] = useState({ name: '', amount: '', category: '', date: today, note: '', fromCash: true });
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [kind, setKind] = useState<'all' | 'regular' | 'recurring'>('all');
  const [del, setDel] = useState<any>(null);
  const [delReason, setDelReason] = useState('');

  const list = useQuery({ queryKey: ['expenses', from, to, kind], queryFn: () => api<any[]>(`/api/expenses?from=${from}&to=${to}&kind=${kind}`) });
  const total = (list.data ?? []).reduce((s, e) => s.plus(e.amount), D(0));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseMoney(f.amount);
    if (!f.name.trim()) return toast('error', t('Xarajat nomini kiriting'));
    if (!amount || D(amount).lte(0)) return toast('error', t('Summani kiriting'));
    if (f.date > today) return toast('error', t('Kelajakdagi sana uchun xarajat kiritib bo‘lmaydi'));
    setBusy(true);
    const r = await submitOp('expense.create', {
      id: uuid(), name: f.name.trim(), amount, category: f.category.trim() || null, expenseDate: f.date, note: f.note.trim() || null,
      paidFromCash: f.fromCash,
    });
    setBusy(false);
    if (r.status === 'error') return toast('error', r.error!);
    toast('ok', t('Xarajat saqlandi'));
    setF({ ...f, name: '', amount: '', note: '' });
  };

  const doDelete = async () => {
    if (!delReason.trim()) return toast('error', t('O‘chirish sababini yozing'));
    const r = await submitOp('expense.delete', { id: del.id, reason: delReason.trim() });
    if (r.status === 'error') toast('error', r.error!);
    else toast('ok', t('Xarajat o‘chirildi'));
    setDel(null); setDelReason('');
  };

  return (
    <>
      <TopBar title={t('Xarajatlar')} />
      <div className="page">
        <form className="card" onSubmit={save}>
          <div className="card-head"><h2>{t('Yangi xarajat')}</h2></div>
          <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.4fr 1fr', gap: 12 }}>
            <Field label={t('Xarajat nomi') + ' *'}><input className="input" value={f.name} placeholder={t('Masalan: Tushlik')} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label={t('Summa') + ' *'}><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
            <Field label={t('Kategoriya')}>
              <input className="input" list="exp-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
              <datalist id="exp-cats">{CATEGORIES.map((c) => <option key={c} value={t(c)} />)}</datalist>
            </Field>
            <Field label={t('Sana')}><input type="date" className="input" max={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <div style={{ gridColumn: '1 / 3' }}><Field label={t('Izoh')}><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field></div>
            <label className="check" style={{ alignSelf: 'end', paddingBottom: 8 }}>
              <input type="checkbox" checked={f.fromCash} onChange={(e) => setF({ ...f, fromCash: e.target.checked })} /> {t('Kassadan (naqd) to‘landi')}
            </label>
            <div style={{ alignSelf: 'end' }}><button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{t('Saqlash')}</button></div>
          </div>
        </form>

        <div className="card">
          <div className="card-head">
            <div className="row">
              <Tabs value={kind} onChange={setKind} items={[{ value: 'all', label: t('Barchasi') }, { value: 'regular', label: t('Oddiy') }, { value: 'recurring', label: t('Doimiy') }]} />
              <input type="date" className="input" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} /><span>—</span>
              <input type="date" className="input" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>{t('Jami')}: <b className="num">{fmtMoney(total)} {t('so‘m')}</b></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('Sana')}</th><th>{t('Xarajat nomi')}</th><th>{t('Kategoriya')}</th><th>{t('Izoh')}</th><th>{t('Kim kiritdi')}</th><th>{t('Qachon kiritildi')}</th><th>{t('Kassadan')}</th><th className="r">{t('Summa')}</th><th /></tr></thead>
              <tbody>
                {(list.data ?? []).map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDate(e.expenseDate)}</td>
                    <td><b>{e.name}</b>{e.recurringId && <span className="tag tag-blue" style={{ marginLeft: 6 }}>{t('doimiy')}</span>}</td>
                    <td>{e.category ?? '—'}</td><td className="small" style={{ maxWidth: 260 }}>{e.note}</td>
                    <td>{e.userName}</td><td className="small">{fmtDateTime(e.createdAt)}</td><td>{e.paidFromCash ? t('Ha') : t('Yo‘q')}</td>
                    <td className="r"><Money v={e.amount} /></td>
                    <td>{isAdmin(user) && <button className="icon-btn" title={t('O‘chirish')} onClick={() => setDel(e)}><Trash2 size={15} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.isError && <div className="alert alert-warn" style={{ margin: 12 }}>{t('Ma’lumotni yuklab bo‘lmadi. Internet aloqasini tekshiring.')}</div>}
            {list.data && !list.data.length && <Empty text={t('Bu davrda xarajat yo‘q')} />}
          </div>
        </div>
      </div>
      {del && (
        <Confirm title={t('Xarajatni o‘chirish')} danger confirmText={t('O‘chirish')} onClose={() => setDel(null)} onConfirm={doDelete}
          text={t('"{name}" ({s} so‘m) xarajati hisobotlardan olib tashlanadi. Amal tarixda saqlanadi.', { name: del.name, s: fmtMoney(del.amount) })}>
          <Field label={t('Sabab') + ' *'}><input className="input" autoFocus value={delReason} onChange={(e) => setDelReason(e.target.value)} /></Field>
        </Confirm>
      )}
    </>
  );
}
