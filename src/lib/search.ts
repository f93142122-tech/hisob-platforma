/**
 * Mahsulot qidiruvi (Savdo, Mahsulotlar, Ombor sahifalarida bir xil ishlaydi).
 *
 * - Qidiriladigan maydonlar: nom, kategoriya, kod/artikul, izoh, o'lchov birligi, ikkinchi birlik. Narx bo'yicha emas.
 * - Bir nechta so'z: har bir so'z qaysidir maydonda uchrashi kerak (tartibi muhim emas).
 * - Lotin va kirill bir xil: "кола" → "Cola", "do'kon" → "дўкон".
 * - Apostrof turlari (' ‘ ’ ʻ ʼ) va katta-kichik harf farq qilmaydi: "do‘kon" = "dokon".
 * - Natijalar muhimligi bo'yicha tartiblanadi: aniq kod → nom shu so'z bilan boshlanadi → nomda bor → boshqa maydonlarda.
 */
import type { Product } from './data';

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', қ: 'q',
  л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ў: 'o', ф: 'f', х: 'x', ҳ: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'i', є: 'e',
};

/** Qidiruv uchun matnni bir xil ko'rinishga keltiradi: kichik harf, kirill → lotin, apostroflarsiz. */
export function normalize(text: string | null | undefined): string {
  if (!text) return '';
  let s = text.normalize('NFC').toLowerCase();
  s = s.replace(/[а-яёўқғҳіїє]/g, (ch) => CYR[ch] ?? ch);
  s = s.replace(/[‘’ʻʼ'`´]/g, ''); // o‘ / o' / oʻ → o
  s = s.replace(/c(?!h)/g, 'k'); // brend nomlari: "Cola" = "кола" = "kola" ("ch" o'zgarmaydi)
  s = s.replace(/w/g, 'v');
  s = s.replace(/[^a-z0-9]+/g, ' ').trim(); // tinish belgilari → bo'shliq ("Coca-Cola" → "coca cola")
  return s;
}

/** Bir mahsulot uchun qidiriladigan maydonlar (narx kirmaydi). */
function fields(p: Product) {
  return {
    name: normalize(p.name),
    code: normalize(p.code),
    category: normalize(p.categoryName),
    other: normalize([p.note, p.unit, p.unit === 'kg' ? 'kilogramm' : '', p.altUnit].filter(Boolean).join(' ')),
  };
}

type Indexed = { p: Product; f: ReturnType<typeof fields>; all: string; nameCompact: string; codeCompact: string };
const cache = new WeakMap<Product, Indexed>();
function indexed(p: Product): Indexed {
  let x = cache.get(p);
  if (!x) {
    const f = fields(p);
    x = { p, f, all: ` ${f.name} ${f.code} ${f.category} ${f.other} `, nameCompact: f.name.replace(/ /g, ''), codeCompact: f.code.replace(/ /g, '') };
    cache.set(p, x);
  }
  return x;
}

/** Mahsulot so'rovga mos keladimi va qanchalik (kattaroq — muhimroq). 0 — mos emas. */
function score(x: Indexed, words: string[], whole: string): number {
  // Har bir so'z qaysidir maydonda (yoki birlashtirilgan nom/kodda) bo'lishi shart
  for (const w of words) {
    if (!x.all.includes(w) && !x.nameCompact.includes(w) && !x.codeCompact.includes(w)) return 0;
  }
  const compact = whole.replace(/ /g, '');
  let s = 1;
  if (x.codeCompact && x.codeCompact === compact) s += 1000; // shtrix-kod to'liq mos
  else if (x.codeCompact && x.codeCompact.startsWith(compact)) s += 300;
  if (x.f.name === whole) s += 500;
  else if (x.f.name.startsWith(whole)) s += 200;
  else if (words.every((w) => (' ' + x.f.name).includes(' ' + w))) s += 120; // har bir so'z nomdagi so'z boshida
  else if (words.every((w) => x.f.name.includes(w) || x.nameCompact.includes(w))) s += 80;
  if (words.some((w) => x.f.category.includes(w))) s += 30;
  return s;
}

/** Mahsulotlarni qidiradi va muhimligi bo'yicha tartiblaydi. Bo'sh so'rov — hammasi (o'z tartibida). */
export function searchProducts(products: Product[], query: string, limit?: number): Product[] {
  const whole = normalize(query);
  if (!whole) return limit ? products.slice(0, limit) : products;
  const words = whole.split(' ');
  const found: { p: Product; s: number; i: number }[] = [];
  products.forEach((p, i) => {
    const s = score(indexed(p), words, whole);
    if (s > 0) found.push({ p, s, i });
  });
  found.sort((a, b) => b.s - a.s || a.i - b.i);
  const res = found.map((r) => r.p);
  return limit ? res.slice(0, limit) : res;
}
