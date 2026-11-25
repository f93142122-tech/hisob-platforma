import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useT } from './i18n';
import { API_URL, api, session } from './api';
import { fmtMoney } from './money';

// ---------- Bildirishnomalar ----------
type Toast = { id: number; kind: 'ok' | 'error' | 'info' | 'warn'; text: string };
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status">
        {items.map((i) => (
          <div key={i.id} className={`toast toast-${i.kind}`} onClick={() => setItems((x) => x.filter((y) => y.id !== i.id))}>
            {i.kind === 'ok' ? <CheckCircle2 size={18} /> : i.kind === 'info' ? <Info size={18} /> : <AlertTriangle size={18} />}
            <span>{i.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Modal oyna ----------
export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Xavfli amallar oldidan tasdiqlash oynasi. */
export function Confirm({ title, text, danger, confirmText, onConfirm, onClose, children }: {
  title: string; text: string; danger?: boolean; confirmText?: string; onConfirm: () => void | Promise<void>; onClose: () => void; children?: ReactNode;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>{t('Bekor qilish')}</button>
      <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>
        {confirmText ?? t('Tasdiqlash')}
      </button>
    </>}>
      <p>{text}</p>
      {children}
    </Modal>
  );
}

// ---------- Maydonlar ----------
export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/** Summa kiritish: yozish paytida 1 250 000 ko'rinishida guruhlaydi. */
export function MoneyInput({ value, onChange, placeholder, autoFocus, className, onEnter, ariaLabel }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; className?: string; onEnter?: () => void; ariaLabel?: string;
}) {
  const display = value === '' ? '' : formatTyping(value);
  return (
    <input
      className={`input money ${className ?? ''}`} inputMode="decimal" value={display} placeholder={placeholder ?? '0'} autoFocus={autoFocus} aria-label={ariaLabel}
      onChange={(e) => {
        const raw = e.target.value.replace(/\s/g, '').replace(',', '.');
        if (raw === '' || /^\d{0,13}(\.\d{0,2})?$/.test(raw)) onChange(raw);
      }}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }}
    />
  );
}
function formatTyping(v: string) {
  const [i, f] = v.split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f !== undefined ? ',' + f : '');
}

export const Money = ({ v, className }: { v: string | number | null | undefined; className?: string }) => (
  <span className={`num ${className ?? ''}`}>{fmtMoney(v ?? 0)}</span>
);

export function ErrBadge() {
  return <span className="badge-err" title="Mahsulot tugagan">ERR</span>;
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((i) => (
        <button key={i.value} role="tab" aria-selected={value === i.value} className={`tab ${value === i.value ? 'active' : ''}`} onClick={() => onChange(i.value)}>{i.label}</button>
      ))}
    </div>
  );
}

/** Mahsulot rasmi: avtorizatsiya bilan yuklanadi va brauzerda keshlanadi. */
const imgCache = new Map<string, string>();
export function ProductImage({ id, version, size = 40 }: { id: string; version: number; size?: number }) {
  const key = `${id}:${version}`;
  const [src, setSrc] = useState<string | null>(imgCache.get(key) ?? null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (imgCache.has(key)) { setSrc(imgCache.get(key)!); return; }
    fetch(`${API_URL}/api/products/${id}/image?v=${version}`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => { if (b && alive.current) { const u = URL.createObjectURL(b); imgCache.set(key, u); setSrc(u); } })
      .catch(() => {});
    return () => { alive.current = false; };
  }, [key, id, version]);
  return src ? <img src={src} alt="" className="thumb" style={{ width: size, height: size }} /> : <div className="thumb thumb-empty" style={{ width: size, height: size }} />;
}

/** Rasmni 400px gacha kichraytirib, data URL qilib qaytaradi. */
export function resizeImage(file: File, max = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi'));
    img.src = URL.createObjectURL(file);
  });
}

export const payLabel: Record<string, string> = { cash: 'Naqd', card: 'Karta', click: 'Click', debt: 'Nasiya' };

export { api };
