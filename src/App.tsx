import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, HandCoins, Undo2, Receipt, Repeat, BarChart3, LockKeyhole, Settings as SettingsIcon,
  LogOut, WifiOff,
} from 'lucide-react';
import { api, session, setUnauthorizedHandler, type User } from './lib/api';
import { I18nContext, makeT, useT, type Script } from './lib/i18n';
import { AuthContext, useAuth } from './lib/auth';
import { onDataChanged } from './lib/ops';
import { Field, useToast } from './lib/ui';
import { Dashboard } from './pages/Dashboard';
import { Sale } from './pages/Sale';
import { Products } from './pages/Products';
import { Inventory } from './pages/Inventory';
import { Debts } from './pages/Debts';
import { Returns } from './pages/Returns';
import { Expenses } from './pages/Expenses';
import { Recurring } from './pages/Recurring';
import { Reports } from './pages/Reports';
import { Closing } from './pages/Closing';
import { Settings } from './pages/Settings';

const SCRIPT_KEY = 'savdo.script';

export function App() {
  const [user, setUserState] = useState<User | null>(session.user);
  const [script, setScriptState] = useState<Script>(() => (localStorage.getItem(SCRIPT_KEY) as Script) || session.user?.script || 'latn');
  const qc = useQueryClient();

  const setScript = (s: Script) => {
    setScriptState(s);
    localStorage.setItem(SCRIPT_KEY, s);
    if (user) {
      const u = { ...user, script: s };
      session.setUser(u);
      setUserState(u);
      api('/api/auth/script', { method: 'PUT', body: { script: s } }).catch(() => {});
    }
  };
  const i18n = useMemo(() => ({ t: makeT(script), script, setScript }), [script, user]);

  const logout = async () => {
    session.clear();
    setUserState(null);
    qc.clear();
  };
  useEffect(() => { setUnauthorizedHandler(() => { session.clear(); setUserState(null); }); }, []);

  const onLogin = (token: string, u: User) => {
    session.set(token, u);
    setUserState(u);
    if (u.script && !localStorage.getItem(SCRIPT_KEY)) setScriptState(u.script);
  };

  return (
    <I18nContext.Provider value={i18n}>
      {user ? (
        <AuthContext.Provider value={{ user, logout, setUser: (u) => { session.setUser(u); setUserState(u); } }}>
          <Shell />
        </AuthContext.Provider>
      ) : (
        <LoginGate onLogin={onLogin} />
      )}
    </I18nContext.Provider>
  );
}

/** Brauzerning internet holati (faqat ogohlantirish uchun). */
function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

function Shell() {
  const { t } = useT();
  const { user, logout } = useAuth();
  const online = useOnline();
  const qc = useQueryClient();
  const toast = useToast();

  // Amal bajarilgach barcha ro'yxatlar serverdan qayta olinadi
  useEffect(() => onDataChanged(() => qc.invalidateQueries()), [qc]);

  const pending = useQuery({ queryKey: ['recurring-pending'], queryFn: () => api<any[]>('/api/recurring/pending'), refetchInterval: 60_000 });

  const nav: { to: string; label: string; icon: ReactNode; badge?: number }[] = [
    { to: '/', label: t('Bosh sahifa'), icon: <LayoutDashboard size={18} /> },
    { to: '/savdo', label: t('Savdo'), icon: <ShoppingCart size={18} /> },
    { to: '/mahsulotlar', label: t('Mahsulotlar'), icon: <Package size={18} /> },
    { to: '/ombor', label: t('Ombor'), icon: <Warehouse size={18} /> },
    { to: '/nasiya', label: t('Nasiya savdolar'), icon: <HandCoins size={18} /> },
    { to: '/qaytarish', label: t('Qaytarishlar'), icon: <Undo2 size={18} /> },
    { to: '/xarajatlar', label: t('Xarajatlar'), icon: <Receipt size={18} /> },
    { to: '/doimiy-xarajatlar', label: t('Doimiy xarajatlar'), icon: <Repeat size={18} />, badge: pending.data?.length || undefined },
    { to: '/hisobotlar', label: t('Hisobotlar'), icon: <BarChart3 size={18} /> },
    { to: '/kunni-yakunlash', label: t('Kunlik ishni yakunlash'), icon: <LockKeyhole size={18} /> },
    { to: '/sozlamalar', label: t('Sozlamalar'), icon: <SettingsIcon size={18} /> },
  ];

  const doLogout = () => {
    logout();
    toast('info', t('Tizimdan chiqdingiz'));
  };

  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><img src="/icon.svg" alt="" /> {t('Savdo va ombor')}</div>
        <nav className="nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              {n.icon}<span>{n.label}</span>{n.badge ? <span className="badge">{n.badge}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="who">{user.fullName}</div>
          <div>{user.role === 'admin' ? t('Administrator') : t('Sotuvchi')}</div>
          <button onClick={doLogout}><LogOut size={15} /> {t('Chiqish')}</button>
        </div>
      </aside>
      <div className="main">
        {!online && (
          <div className="offline-banner"><WifiOff size={16} />
            {t('Internet yo‘q. Aloqa tiklanmaguncha savdo va boshqa ma’lumotlar saqlanmaydi.')}
          </div>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/savdo" element={<Sale />} />
          <Route path="/mahsulotlar" element={<Products />} />
          <Route path="/ombor" element={<Inventory />} />
          <Route path="/nasiya" element={<Debts />} />
          <Route path="/qaytarish" element={<Returns />} />
          <Route path="/xarajatlar" element={<Expenses />} />
          <Route path="/doimiy-xarajatlar" element={<Recurring />} />
          <Route path="/hisobotlar" element={<Reports />} />
          <Route path="/kunni-yakunlash" element={<Closing />} />
          <Route path="/sozlamalar" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}

/** Sahifa sarlavhasi. */
export function TopBar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="topbar">
      <h1>{title}</h1>
      <div className="row">{children}</div>
    </div>
  );
}

function LoginGate({ onLogin }: { onLogin: (token: string, u: User) => void }) {
  const { t, script, setScript } = useT();
  const status = useQuery({ queryKey: ['setup-status'], queryFn: () => api<{ needsSetup: boolean }>('/api/setup/status') });
  const [form, setForm] = useState({ username: '', password: '', fullName: '', password2: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setup = status.data?.needsSetup;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (setup && form.password !== form.password2) return setErr(t('Parollar bir xil emas'));
    setBusy(true);
    try {
      const r = await api<{ token: string; user: User }>(setup ? '/api/setup' : '/api/auth/login', {
        method: 'POST', body: { username: form.username, password: form.password },
      });
      onLogin(r.token, r.user);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <div className="row"><img src="/icon.svg" width={34} alt="" /><h2>{t('Savdo va ombor')}</h2>
          <span className="spacer" />
          <div className="tabs">
            <button type="button" className={`tab ${script === 'latn' ? 'active' : ''}`} onClick={() => setScript('latn')}>Lotin</button>
            <button type="button" className={`tab ${script === 'cyrl' ? 'active' : ''}`} onClick={() => setScript('cyrl')}>Кирилл</button>
          </div>
        </div>
        {status.isError && <div className="alert alert-warn">{t('Server bilan aloqa yo‘q. Kirish uchun internet kerak.')}</div>}
        {setup && <div className="alert alert-info">{t('Birinchi ishga tushirish: do‘kon nomini yozing va unga parol qo‘ying.')}</div>}
        <Field label={t('Do‘kon nomi')}><input className="input" required autoFocus autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
        <Field label={t('Parol')}><input className="input" type="password" required autoComplete={setup ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        {setup && <Field label={t('Parolni takrorlang')}><input className="input" type="password" required autoComplete="new-password" value={form.password2} onChange={(e) => setForm({ ...form, password2: e.target.value })} /></Field>}
        {err && <div className="alert alert-danger">{err}</div>}
        <button className="btn btn-primary btn-lg" disabled={busy || status.isLoading}>{setup ? t('Yaratish va kirish') : t('Kirish')}</button>
      </form>
    </div>
  );
}
