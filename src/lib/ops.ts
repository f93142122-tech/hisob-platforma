/**
 * Ma'lumotni o'zgartiruvchi amallar (savdo, qaytarish, xarajat, mahsulot...) to'g'ridan-to'g'ri serverga yuboriladi.
 * Har bir amal o'z UUID raqami bilan ketadi: so'rov qayta yuborilsa ham server uni faqat bir marta bajaradi.
 * Internet yoki server bo'lmasa, amal bajarilmaydi va foydalanuvchiga xato ko'rsatiladi.
 */
import { api, isNetworkError } from './api';
import { uuid } from './money';
import { makeT, type Script } from './i18n';

export type OpOutcome = { status: 'ok' | 'error'; result?: any; error?: string };

const listeners = new Set<() => void>();
/** Amal muvaffaqiyatli bajarilganda chaqiriladi (ro'yxatlarni yangilash uchun). */
export function onDataChanged(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export async function submitOp(type: string, payload: any): Promise<OpOutcome> {
  try {
    const r = await api<OpOutcome>('/api/ops', { method: 'POST', body: { id: uuid(), type, payload } });
    if (r.status === 'ok') listeners.forEach((l) => l());
    return r;
  } catch (e: any) {
    if (!isNetworkError(e)) return { status: 'error', error: e.message };
    // Xabar foydalanuvchi tanlagan alifboda chiqsin
    let script: Script = 'latn';
    try { if (localStorage.getItem('savdo.script') === 'cyrl') script = 'cyrl'; } catch { /* e'tiborsiz */ }
    return { status: 'error', error: makeT(script)('Server bilan aloqa yo‘q. Internetni tekshirib, qayta urinib ko‘ring.') };
  }
}
