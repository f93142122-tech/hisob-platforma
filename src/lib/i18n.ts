/**
 * Interfeys tili: o'zbek (lotin yoki kirill).
 * Barcha interfeys matnlari lotinda yoziladi va kirill rejimida avtomatik o'giriladi.
 * Foydalanuvchi kiritgan ma'lumotlar (mahsulot nomi, mijoz va h.k.) HECH QACHON o'girilmaydi — ular t() dan o'tmaydi.
 */
import { createContext, useContext } from 'react';

export type Script = 'latn' | 'cyrl';

// O'girilmaydigan so'zlar (brend, qisqartma)
const KEEP = new Set(['Click', 'ERR', 'PDF', 'ID', 'PostgreSQL']);
// Qoidaga to'g'ri kelmaydigan so'zlar
const OVERRIDES: Record<string, string> = {
  operatsiya: 'операция', operatsiyalar: 'операциялар', sinxronlash: 'синхронлаш', sinxronlanmagan: 'синхронланмаган',
  sinxronlandi: 'синхронланди', sinxronlanmoqda: 'синхронланмоқда', administrator: 'администратор', kategoriya: 'категория',
  kategoriyasi: 'категорияси', kategoriyalar: 'категориялар', kategoriyani: 'категорияни', internet: 'интернет',
  smena: 'смена', smenani: 'сменани', oflayn: 'офлайн', onlayn: 'онлайн',
};

const VOWELS = 'aeiouAEIOUўЎ';
const map: Record<string, string> = {
  a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п',
  q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', c: 'с', w: 'в',
};

function translitWord(w: string): string {
  if (KEEP.has(w) || /\d/.test(w)) return w;
  const lower = w.toLowerCase().replace(/[‘’ʻʼ'`]/g, '’');
  const plain = lower.replace(/’/g, "'");
  if (OVERRIDES[plain]) return applyCase(w, OVERRIDES[plain]);
  let out = '';
  for (let i = 0; i < lower.length; i++) {
    const c = lower[i], n = lower[i + 1];
    const prev = i === 0 ? '' : lower[i - 1];
    if ((c === 'o' || c === 'g') && n === '’') { out += c === 'o' ? 'ў' : 'ғ'; i++; continue; }
    if (c === 's' && n === 'h') { out += 'ш'; i++; continue; }
    if (c === 'c' && n === 'h') { out += 'ч'; i++; continue; }
    // yo‘ → йў (masalan, yo‘q → йўқ), yo → ё
    if (c === 'y' && n && 'oaue'.includes(n) && !(n === 'o' && lower[i + 2] === '’')) { out += { o: 'ё', a: 'я', u: 'ю', e: 'е' }[n]; i++; continue; }
    if (c === 'e') { out += !prev || VOWELS.includes(prev) || prev === '’' ? 'э' : 'е'; continue; }
    if (c === '’') { out += 'ъ'; continue; }
    out += map[c] ?? c;
  }
  return applyCase(w, out);
}

function applyCase(src: string, out: string) {
  if (src.length > 1 && src === src.toUpperCase() && /[A-Z]/.test(src)) return out.toUpperCase();
  if (/^[A-Z]/.test(src)) return out[0].toUpperCase() + out.slice(1);
  return out;
}

const cache = new Map<string, string>();
export function toCyrillic(text: string): string {
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  // {placeholder} lar o'zgarmaydi
  const res = text.split(/(\{\w+\})/).map((part) =>
    part.startsWith('{') ? part : part.replace(/[A-Za-z][A-Za-z‘’ʻʼ'`]*[A-Za-z]|[A-Za-z]/g, (w) => translitWord(w)),
  ).join('');
  cache.set(text, res);
  return res;
}

export type T = (text: string, vars?: Record<string, string | number>) => string;
export function makeT(script: Script): T {
  return (text, vars) => {
    let s = script === 'cyrl' ? toCyrillic(text) : text;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

export const I18nContext = createContext<{ t: T; script: Script; setScript: (s: Script) => void }>({
  t: makeT('latn'), script: 'latn', setScript: () => {},
});
export const useT = () => useContext(I18nContext);
