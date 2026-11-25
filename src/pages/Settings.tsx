import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useCategories, useProducts } from '../lib/data';
import { useT } from '../lib/i18n';
import { useAuth, isAdmin } from '../lib/auth';
import { fmtDateTime } from '../lib/money';
import { Confirm, Empty, Field, Modal, Tabs, useToast } from '../lib/ui';
import { TopBar } from '../App';

type Tab = 'general' | 'categories' | 'users' | 'audit';

export function Settings() {
  const { t } = useT();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'general';
  const items: { value: Tab; label: string }[] = [
    { value: 'general', label: t('Umumiy') }, { value: 'categories', label: t('Kategoriyalar') },
    ...(isAdmin(user) ? [{ value: 'users' as Tab, label: t('Foydalanuvchilar') }] : []),
    ...(isAdmin(user) ? [{ value: 'audit' as Tab, label: t('Amallar tarixi') }] : []),
  ];
  return (
    <>
      <TopBar title={t('Sozlamalar')} />
      <div className="page">
        <div><Tabs value={tab} onChange={(v) => setParams({ tab: v })} items={items} /></div>
        {tab === 'general' && <General />}
        {tab === 'categories' && <Categories />}
        {tab === 'users' && isAdmin(user) && <Users />}
        {tab === 'audit' && isAdmin(user) && <Audit />}
      </div>
    </>
  );
}

function General() {
  const { t, script, setScript } = useT();
  const toast = useToast();
  const [pw, setPw] = useState({ old: '', next: '', again: '' });
  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.again) return toast('error', t('Parollar bir xil emas'));
    try {
      await api('/api/auth/password', { method: 'POST', body: { oldPassword: pw.old, newPassword: pw.next } });
      toast('ok', t('Parol o‘zgartirildi'));
      setPw({ old: '', next: '', again: '' });
    } catch (er: any) { toast('error', er.message); }
  };
  return (
    <div className="grid grid-2">
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2>{t('Interfeys alifbosi')}</h2>
        <p className="muted" style={{ margin: 0 }}>{t('Faqat menyu va tugmalar yozuvi o‘zgaradi. Siz kiritgan mahsulot, mijoz va boshqa nomlar qanday yozilgan bo‘lsa, shunday qoladi.')}</p>
        <div className="row">
          <label className="check"><input type="radio" checked={script === 'latn'} onChange={() => setScript('latn')} /> O‘zbek (lotin)</label>
          <label className="check"><input type="radio" checked={script === 'cyrl'} onChange={() => setScript('cyrl')} /> Ўзбек (кирилл)</label>
        </div>
      </div>
      <form className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={change}>
        <h2>{t('Parolni o‘zgartirish')}</h2>
        <Field label={t('Joriy parol')}><input className="input" type="password" autoComplete="current-password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} /></Field>
        <Field label={t('Yangi parol')} hint={t('Kamida 6 belgi')}><input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
        <Field label={t('Yangi parolni takrorlang')}><input className="input" type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></Field>
        <div className="row-end"><button className="btn btn-primary">{t('Saqlash')}</button></div>
      </form>
    </div>
  );
}

function Categories() {
  const { t } = useT();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const cats = useCategories().data ?? [];
  const products = useProducts().data ?? [];
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['categories'] }); qc.invalidateQueries({ queryKey: ['products'] }); };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { await api('/api/categories', { method: 'POST', body: { name: name.trim() } }); setName(''); toast('ok', t('Qo‘shildi')); refresh(); } catch (er: any) { toast('error', er.message); }
  };
  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <form className="card-head" onSubmit={add}>
        <input className="input" style={{ flex: 1 }} placeholder={t('Yangi kategoriya nomi')} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary"><Plus size={16} /> {t('Qo‘shish')}</button>
      </form>
      <table>
        <thead><tr><th>{t('Nomi')}</th><th className="r">{t('Mahsulotlar')}</th><th /></tr></thead>
        <tbody>{cats.map((c) => (
          <tr key={c.id}><td>{c.name}</td><td className="r">{products.filter((p) => p.categoryId === c.id).length}</td>
            <td className="r">
              <button className="icon-btn" onClick={() => setEdit(c)}><Pencil size={15} /></button>
              {isAdmin(user) && <button className="icon-btn" onClick={() => setDel(c)}><Trash2 size={15} /></button>}
            </td></tr>
        ))}</tbody>
      </table>
      {!cats.length && <Empty text={t('Kategoriyalar yo‘q')} />}
      {edit && (
        <Modal title={t('Kategoriyani tahrirlash')} onClose={() => setEdit(null)} footer={<button className="btn btn-primary" onClick={async () => {
          try { await api(`/api/categories/${edit.id}`, { method: 'PUT', body: { name: edit.name } }); setEdit(null); toast('ok', t('Saqlandi')); refresh(); } catch (er: any) { toast('error', er.message); }
        }}>{t('Saqlash')}</button>}>
          <input className="input" autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
        </Modal>
      )}
      {del && <Confirm title={t('Kategoriyani o‘chirish')} danger confirmText={t('O‘chirish')} text={t('"{name}" kategoriyasi o‘chiriladi.', { name: del.name })} onClose={() => setDel(null)}
        onConfirm={async () => { try { await api(`/api/categories/${del.id}`, { method: 'DELETE' }); toast('ok', t('O‘chirildi')); refresh(); } catch (er: any) { toast('error', er.message); } setDel(null); }} />}
    </div>
  );
}

function Users() {
  const { t } = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['users'], queryFn: () => api<any[]>('/api/users') });
  const [form, setForm] = useState<any>(null);
  const save = async () => {
    try {
      if (form.id) await api(`/api/users/${form.id}`, { method: 'PUT', body: { fullName: form.fullName, role: form.role, active: form.active, ...(form.password ? { password: form.password } : {}) } });
      else await api('/api/users', { method: 'POST', body: { username: form.username, fullName: form.fullName, role: form.role, password: form.password } });
      toast('ok', t('Saqlandi'));
      setForm(null);
      qc.invalidateQueries({ queryKey: ['users'] });
    } catch (e: any) { toast('error', e.message); }
  };
  return (
    <div className="card" style={{ maxWidth: 900 }}>
      <div className="card-head"><h2>{t('Foydalanuvchilar')}</h2><button className="btn btn-primary" onClick={() => setForm({ username: '', fullName: '', role: 'seller', password: '', active: true })}><Plus size={16} /> {t('Yangi foydalanuvchi')}</button></div>
      <table>
        <thead><tr><th>{t('Ism')}</th><th>{t('Kirish nomi')}</th><th>{t('Rol')}</th><th>{t('Holati')}</th><th /></tr></thead>
        <tbody>{(list.data ?? []).map((u) => (
          <tr key={u.id}><td>{u.fullName}</td><td>{u.username}</td><td>{u.role === 'admin' ? t('Administrator') : t('Sotuvchi')}</td>
            <td>{u.active ? <span className="tag tag-ok">{t('Faol')}</span> : <span className="tag tag-danger">{t('Bloklangan')}</span>}</td>
            <td className="r"><button className="icon-btn" onClick={() => setForm({ ...u, password: '' })}><Pencil size={15} /></button></td></tr>
        ))}</tbody>
      </table>
      {form && (
        <Modal title={form.id ? t('Foydalanuvchini tahrirlash') : t('Yangi foydalanuvchi')} onClose={() => setForm(null)} footer={<>
          <button className="btn" onClick={() => setForm(null)}>{t('Bekor qilish')}</button><button className="btn btn-primary" onClick={save}>{t('Saqlash')}</button></>}>
          <Field label={t('To‘liq ism')}><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
          <Field label={t('Kirish nomi')} hint={t('Shu nom va parol bilan tizimga kiradi')}><input className="input" disabled={!!form.id} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
          <Field label={t('Rol')}><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="seller">{t('Sotuvchi')}</option><option value="admin">{t('Administrator')}</option></select></Field>
          <Field label={form.id ? t('Yangi parol (o‘zgartirmaslik uchun bo‘sh qoldiring)') : t('Parol')}><input className="input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          {form.id && <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> {t('Faol (tizimga kira oladi)')}</label>}
        </Modal>
      )}
    </div>
  );
}

const actionLabel: Record<string, string> = {
  'sale.create': 'Savdo', 'return.create': 'Qaytarish', 'debt.payment': 'Nasiya to‘lovi', 'expense.create': 'Xarajat', 'expense.delete': 'Xarajat o‘chirildi',
  'recurring.confirm': 'Doimiy xarajat tasdiqlandi', 'recurring.skip': 'Doimiy xarajat o‘tkazib yuborildi', 'recurring.create': 'Doimiy xarajat yaratildi', 'recurring.update': 'Doimiy xarajat o‘zgartirildi',
  'product.create': 'Mahsulot qo‘shildi', 'product.update': 'Mahsulot o‘zgartirildi', 'product.archive': 'Mahsulot arxivlandi', 'product.restore': 'Mahsulot tiklandi',
  'stock.receipt': 'Omborga kirim', 'stock.adjust': 'Qoldiq tuzatildi', 'closing.close': 'Kun yakunlandi', 'closing.reclose': 'Kun qayta yopildi',
  'auth.login': 'Tizimga kirish', 'user.create': 'Foydalanuvchi qo‘shildi', 'user.update': 'Foydalanuvchi o‘zgartirildi', 'user.password': 'Parol o‘zgartirildi',
  'category.create': 'Kategoriya qo‘shildi', 'category.update': 'Kategoriya o‘zgartirildi', 'category.delete': 'Kategoriya o‘chirildi', 'conflict.resolve': 'Nizo hal qilindi', 'setup.admin': 'Tizim sozlandi',
};

function Audit() {
  const { t } = useT();
  const [date, setDate] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date()));
  const q = useQuery({ queryKey: ['audit', date], queryFn: () => api<any[]>(`/api/audit?from=${date}&to=${date}&limit=1000`) });
  return (
    <div className="card">
      <div className="card-head"><h2>{t('Amallar tarixi')}</h2><input type="date" className="input" style={{ width: 170 }} value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="table-wrap"><table>
        <thead><tr><th>{t('Vaqt')}</th><th>{t('Kim')}</th><th>{t('Amal')}</th><th>{t('Tafsilot')}</th></tr></thead>
        <tbody>{(q.data ?? []).map((a) => (
          <tr key={a.id}><td className="small">{fmtDateTime(a.createdAt)}</td><td>{a.userName ?? '—'}</td><td>{t(actionLabel[a.action] ?? a.action)}</td>
            <td className="small muted" style={{ maxWidth: 520, wordBreak: 'break-word' }}>{a.details ? JSON.stringify(a.details) : ''}</td></tr>
        ))}</tbody>
      </table></div>
      {q.data && !q.data.length && <Empty text={t('Bu kunda amal yo‘q')} />}
    </div>
  );
}
