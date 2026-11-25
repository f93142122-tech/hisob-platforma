import { Decimal } from 'decimal.js';

export { Decimal };
export const D = (v: Decimal.Value | null | undefined) => {
  try { return new Decimal(v === '' || v == null ? 0 : v); } catch { return new Decimal(0); }
};

/** "1250000.00" → "1 250 000" (tiyin bo'lsa → "1 250 000,50") */
export function fmtMoney(v: Decimal.Value | null | undefined): string {
  const d = D(v);
  const neg = d.isNeg() && !d.isZero();
  const abs = d.abs();
  const [int, frac] = abs.toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (neg ? '−' : '') + grouped + (frac !== '00' ? ',' + frac : '');
}
export const som = (v: Decimal.Value | null | undefined) => `${fmtMoney(v)} so‘m`;

/** Foydalanuvchi kiritgan summa: bo'shliqlarni olib tashlaydi, vergulni nuqtaga almashtiradi. */
export function parseMoney(input: string): string | null {
  const s = input.replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(s)) return null;
  return new Decimal(s).toFixed(2);
}

/** Miqdor: "2.500" → "2,5"; "1250" → "1 250" */
export function fmtQty(v: Decimal.Value | null | undefined): string {
  const d = D(v).toDecimalPlaces(3);
  const neg = d.isNeg() && !d.isZero();
  const [int, frac] = d.abs().toString().split('.');
  return (neg ? '−' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (frac ? ',' + frac : '');
}

/** Foydalanuvchi kiritgan miqdor (vergul yoki nuqta bilan). Noto'g'ri bo'lsa null. */
export function parseQty(input: string, allowDecimal: boolean): string | null {
  const s = input.replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  if (!(allowDecimal ? /^\d{1,10}(\.\d{1,3})?$/ : /^\d{1,10}$/).test(s)) return null;
  return s;
}

export const uuid = () => crypto.randomUUID();

export function todayLocal() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
}
export function fmtDate(v: string | Date | null | undefined) {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-');
    return `${d}.${m}.${y}`;
  }
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(v));
}
export function fmtDateTime(v: string | Date | null | undefined) {
  if (!v) return '';
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v));
}
export function fmtTime(v: string | Date | null | undefined) {
  if (!v) return '';
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' }).format(new Date(v));
}
export function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}
