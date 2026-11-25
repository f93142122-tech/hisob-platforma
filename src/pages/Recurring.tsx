import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, CheckCircle2, SkipForward } from 'lucide-react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { D, fmtDate, fmtMoney, parseMoney, todayLocal, uuid } from '../lib/money';
import { submitOp } from '../lib/ops';
import { Confirm, Empty, Field, Modal, Money, MoneyInput, useToast } from '../lib/ui';
import { TopBar } from '../App';

const periodLabel: Record<string, string> = { daily: 'Kunlik', weekly: 'Haftalik', monthly: 'Oylik' };

export function Recurring() {
  const { t } = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['recurring'], queryFn: () => api<any[]>('/api/recurring') });
  const pending = useQuery({ queryKey: ['recurring-pending'], queryFn: () => api<any[]>('/api/recurring/pending') });
  const [edit, setEdit] = useState<any | 'new' | null>(null);
  const [confirming, setConfirming] = useState<any>(null);
  const [skip, setSkip] = useState<any>(null);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['recurring'] }); qc.invalidateQueries({ queryKey: ['recurring-pending'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };

  return (
    <>
      <TopBar title={t('Doimiy xarajatlar')}>
        <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> {t('Yangi doimiy xarajat')}</button>
      </TopBar>
      <div className="page">
        <div className="alert alert-info">{t('Doimiy xarajatlar foydadan avtomatik ayrilmaydi. Muddati kelganda shu yerda ko‘rinadi — tasdiqlaganingizdan keyingina xarajat sifatida hisobga olinadi. Bir davr faqat bir marta hisoblanadi.')}</div>

        <div className="card">
          <div className="card-head"><h2>{t('Tasdiqlash kutilmoqda')} {pending.data?.length ? <span className="tag tag-warn">{pending.data.length}</span> : null}</h2></div>
          {pending.data?.length ? (
            <table>
              <thead><tr><th>{t('Muddat sanasi')}</th><th>{t('Xarajat')}</th><th>{t('Davr')}</th><th className="r">{t('Summa')}</th><th /></tr></thead>
              <tbody>{pending.data.map((p) => (
                <tr key={p.recurringId + p.periodKey}>
                  <td>{fmtDate(p.periodKey)}{p.periodKey === todayLocal() && <span className="tag tag-blue" style={{ marginLeft: 6 }}>{t('bugun')}</span>}</td>
                  <td><b>{p.name}</b>{p.note && <div className="small muted">{p.note}</div>}</td><td>{t(periodLabel[p.period])}</td>
                  <td className="r"><Money v={p.amount} /></td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm btn-ok" onClick={() => setConfirming(p)}><CheckCircle2 size={14} /> {t('Tasdiqlash')}</button>{' '}
                    <button className="btn btn-sm btn-ghost" onClick={() => setSkip(p)} title={t('Bu davr uchun hisoblanmasin')}><SkipForward size={14} /> {t('O‘tkazib yuborish')}</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          ) : <Empty text={pending.isError ? t('Ma’lumotni yuklab bo‘lmadi. Internet aloqasini tekshiring.') : t('Muddati kelgan tasdiqlanmagan xarajat yo‘q')} />}
        </div>

        <div className="card">
          <div className="card-head"><h2>{t('Doimiy xarajatlar ro‘yxati')}</h2></div>
          <table>
            <thead><tr><th>{t('Nomi')}</th><th>{t('Davr')}</th><th>{t('Boshlanish sanasi')}</th><th>{t('Oxirgi tasdiqlangan')}</th><th>{t('Kassadan')}</th><th>{t('Holati')}</th><th className="r">{t('Summa')}</th><th /></tr></thead>
            <tbody>{(list.data ?? []).map((r) => (
              <tr key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
                <td><b>{r.name}</b>{r.note && <div className="small muted">{r.note}</div>}</td><td>{t(periodLabel[r.period])}</td>
                <td>{fmtDate(r.startDate)}</td><td>{r.lastConfirmed ? fmtDate(r.lastConfirmed) : '—'}</td><td>{r.paidFromCash ? t('Ha') : t('Yo‘q')}</td>
                <td>{r.active ? <span className="tag tag-ok">{t('Faol')}</span> : <span className="tag">{t('To‘xtatilgan')}</span>}</td>
                <td className="r"><Money v={r.amount} /></td>
                <td><button className="icon-btn" onClick={() => setEdit(r)} title={t('Tahrirlash')}><Pencil size={15} /></button></td>
              </tr>
            ))}</tbody>
          </table>
          {list.data && !list.data.length && <Empty text={t('Doimiy xarajatlar yo‘q')} />}
        </div>
      </div>
      {edit && <RecurringForm item={edit === 'new' ? null : edit} onClose={() => { setEdit(null); refresh(); }} />}
      {confirming && <ConfirmModal p={confirming} onClose={() => { setConfirming(null); refresh(); }} />}
      {skip && (
        <Confirm title={t('Davrni o‘tkazib yuborish')} text={t('"{name}" — {d} sanasidagi davr xarajat sifatida hisoblanmaydi va ro‘yxatdan olib tashlanadi.', { name: skip.name, d: fmtDate(skip.periodKey) })}
          onClose={() => setSkip(null)} onConfirm={async () => {
            const r = await submitOp('recurring.skip', { recurringId: skip.recurringId, periodKey: skip.periodKey });
            if (r.status === 'error') toast('error', r.error!); else toast('ok', t('O‘tkazib yuborildi'));
            setSkip(null); refresh();
          }} />
      )}
    </>
  );
}

function ConfirmModal({ p, onClose }: { p: any; onClose: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const [amount, setAmount] = useState(D(p.amount).toFixed(2).replace(/\.00$/, ''));
  const [fromCash, setFromCash] = useState<boolean>(p.paidFromCash);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const a = parseMoney(amount);
    if (!a || D(a).lte(0)) return toast('error', t('Summani kiriting'));
    setBusy(true);
    const r = await submitOp('recurring.confirm', { id: uuid(), recurringId: p.recurringId, periodKey: p.periodKey, amount: a, paidFromCash: fromCash, note: note.trim() || null });
    setBusy(false);
    if (r.status === 'error') return toast('error', r.error!);
    toast('ok', t('Xarajat tasdiqlandi va hisobga olindi'));
    onClose();
  };
  return (
    <Modal title={t('Doimiy xarajatni tasdiqlash')} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>{t('Bekor qilish')}</button>
      <button className="btn btn-ok" disabled={busy} onClick={save}>{t('Tasdiqlash')}</button>
    </>}>
      <p><b>{p.name}</b> — {fmtDate(p.periodKey)} {t('davri uchun')}. {t('Tasdiqlangach, shu sanadagi xarajat sifatida sof foydadan ayriladi.')}</p>
      <Field label={t('Summa')} hint={t('Agar bu safar summa boshqacha bo‘lsa, o‘zgartiring')}><MoneyInput value={amount} onChange={setAmount} autoFocus /></Field>
      <label className="check"><input type="checkbox" checked={fromCash} onChange={(e) => setFromCash(e.target.checked)} /> {t('Kassadan (naqd) to‘landi')}</label>
      <Field label={t('Izoh')}><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}

function RecurringForm({ item, onClose }: { item: any | null; onClose: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const [f, setF] = useState({
    name: item?.name ?? '', amount: item ? D(item.amount).toFixed(2).replace(/\.00$/, '') : '', period: item?.period ?? 'monthly',
    startDate: item?.startDate ?? todayLocal(), category: item?.category ?? '', note: item?.note ?? '', paidFromCash: item?.paidFromCash ?? true, active: item?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const amount = parseMoney(f.amount);
    if (!f.name.trim()) return toast('error', t('Nomini kiriting'));
    if (!amount || D(amount).lte(0)) return toast('error', t('Summani kiriting'));
    setBusy(true);
    try {
      const body = { ...f, name: f.name.trim(), amount, category: f.category || null, note: f.note || null };
      await api(item ? `/api/recurring/${item.id}` : '/api/recurring', { method: item ? 'PUT' : 'POST', body });
      toast('ok', t('Saqlandi'));
      onClose();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={item ? t('Doimiy xarajatni tahrirlash') : t('Yangi doimiy xarajat')} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>{t('Bekor qilish')}</button>
      <button className="btn btn-primary" disabled={busy} onClick={save}>{t('Saqlash')}</button>
    </>}>
      <div className="form-grid">
        <div className="full"><Field label={t('Xarajat nomi') + ' *'}><input className="input" autoFocus value={f.name} placeholder={t('Masalan: Sotuvchining oylik maoshi')} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
        <Field label={t('Miqdori') + ' *'}><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
        <Field label={t('Takrorlanish davri')}>
          <select className="input" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })}>
            <option value="daily">{t('Kunlik')}</option><option value="weekly">{t('Haftalik')}</option><option value="monthly">{t('Oylik')}</option>
          </select>
        </Field>
        <Field label={t('Boshlanish sanasi')} hint={f.period === 'monthly' ? t('Har oyning shu kunida muddat keladi') : f.period === 'weekly' ? t('Har 7 kunda muddat keladi') : undefined}>
          <input type="date" className="input" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
        <Field label={t('Kategoriya')}><input className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
        <div className="full"><Field label={t('Izoh')}><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field></div>
        <label className="check"><input type="checkbox" checked={f.paidFromCash} onChange={(e) => setF({ ...f, paidFromCash: e.target.checked })} /> {t('Odatda kassadan (naqd) to‘lanadi')}</label>
        <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> {t('Faol')}</label>
      </div>
    </Modal>
  );
}
