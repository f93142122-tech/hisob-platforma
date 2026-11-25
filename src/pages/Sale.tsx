import { useMemo, useRef, useState } from 'react';
import { Search, Trash2, Minus, Plus, ShoppingCart } from 'lucide-react';
import { isDecimalUnit, useCustomers, useProducts, type Product } from '../lib/data';
import { useT } from '../lib/i18n';
import { D, fmtMoney, fmtQty, parseMoney, parseQty, uuid } from '../lib/money';
import { submitOp } from '../lib/ops';
import { Empty, ErrBadge, Field, Money, MoneyInput, ProductImage, useToast } from '../lib/ui';
import { TopBar } from '../App';
import { useBarcodeScanner } from '../lib/scanner';
import { searchProducts } from '../lib/search';

/**
 * Savat qatori. Mahsulot asosiy birlikda (dona / kg / metr) yoki ikkinchi birlikda (masalan qop) sotiladi.
 * qty — tanlangan birlikda (matn, chunki kasr bo'lishi mumkin); factor — shu birlikda nechta asosiy birlik bor.
 */
interface Line {
  key: string; productId: string; name: string; unit: 'base' | 'alt'; unitName: string; factor: string;
  qty: string; unitPrice: string; price: string; discountPrice: string | null; premiumPrice: string | null; costPrice: string;
}
type Method = 'cash' | 'card' | 'click' | 'debt';
const METHODS: { m: Method; label: string }[] = [
  { m: 'cash', label: 'Naqd' }, { m: 'card', label: 'Karta' }, { m: 'click', label: 'Click' }, { m: 'debt', label: 'Nasiya' },
];

/** Mahsulotdan berilgan birlikdagi savat qatorini yasaydi. */
function makeLine(p: Product, unit: 'base' | 'alt', qty: string): Line {
  const alt = unit === 'alt' && !!p.altUnit;
  const factor = alt ? p.altFactor! : '1';
  const price = alt ? p.altPrice! : p.price;
  return {
    key: `${p.id}:${alt ? 'alt' : 'base'}`, productId: p.id, name: p.name, unit: alt ? 'alt' : 'base',
    unitName: alt ? p.altUnit! : p.unit, factor, qty, unitPrice: plain(price), price,
    discountPrice: alt ? null : p.discountPrice, premiumPrice: alt ? null : p.premiumPrice,
    costPrice: D(p.costPrice).times(factor).toFixed(2), // tanlangan birlik uchun tannarx
  };
}

export function Sale() {
  const { t } = useT();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [cart, setCart] = useState<Line[]>([]);
  const [pay, setPay] = useState<Record<Method, string>>({ cash: '', card: '', click: '', debt: '' });
  const [payTouched, setPayTouched] = useState(false);
  const [customer, setCustomer] = useState({ name: '', phone: '', note: '' });
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const productsQ = useProducts();
  const products = productsQ.data ?? [];
  const customers = useCustomers().data ?? [];
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Tez qidiruv: nom bo'yicha qism, kod bo'yicha aniq yoki boshlanishi
  // Qidiruv: nom, kod, kategoriya, birlik, izoh (lotin/kirill, bir nechta so'z) — eng moslari oldinda
  const results = useMemo(() => searchProducts(products, q, 60), [q, products]);

  const sumTotal = (lines: Line[]) => lines.reduce((s, l) => s.plus(D(l.unitPrice || 0).times(D(l.qty || 0))), D(0)).toDecimalPlaces(2);
  const totals = useMemo(() => {
    const base = cart.reduce((s, l) => s.plus(D(l.price).times(D(l.qty || 0))), D(0)).toDecimalPlaces(2);
    const total = sumTotal(cart);
    return { base, total, discount: base.minus(total) };
  }, [cart]);

  const autoPay = (total: string, method: Method = 'cash') => {
    setPay({ cash: '', card: '', click: '', debt: '', [method]: D(total).gt(0) ? plain(D(total).toFixed(2)) : '' });
  };
  const updateCart = (next: Line[]) => {
    setCart(next);
    if (!payTouched) autoPay(sumTotal(next).toFixed(2));
  };

  const add = (p: Product) => {
    if (D(p.stock).lte(0)) toast('warn', t('"{name}" omborda qolmagan (ERR). Savdo qayd etiladi, qoldiq manfiy bo‘ladi.', { name: p.name }));
    const key = `${p.id}:base`;
    const ex = cart.find((l) => l.key === key);
    if (ex) updateCart(cart.map((l) => (l === ex ? { ...l, qty: D(l.qty || 0).plus(1).toString() } : l)));
    else updateCart([...cart, makeLine(p, 'base', '1')]);
    setQ('');
    setSel(0);
    searchRef.current?.focus();
  };

  // Shtrix-kod skaneri: kursor qaysi maydonda bo'lmasin (miqdor, narx...), skanerlangan mahsulot savatga qo'shiladi
  useBarcodeScanner((code) => {
    const p = products.find((x) => x.code && x.code.toLowerCase() === code.toLowerCase());
    if (p) add(p);
    else toast('error', t('"{q}" kodli mahsulot topilmadi', { q: code }));
  });

  // Qo'lda qidirish: Enter — tanlangan natijani savatga qo'shadi
  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const p = results[sel];
      if (p) add(p);
      else if (q.trim()) toast('error', t('"{q}" bo‘yicha mahsulot topilmadi', { q: q.trim() }));
    }
  };

  const setLine = (i: number, patch: Partial<Line>) => updateCart(cart.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  /** Qatorni boshqa birlikka o'tkazish (masalan kg → qop). Shu birlikdagi qator bo'lsa, birlashtiriladi. */
  const switchUnit = (i: number, unit: 'base' | 'alt') => {
    const l = cart[i];
    const p = byId.get(l.productId);
    if (!p || l.unit === unit) return;
    const next = makeLine(p, unit, unit === 'alt' || !isDecimalUnit(p.unit) ? '1' : l.qty || '1');
    const dupIdx = cart.findIndex((x) => x.key === next.key);
    if (dupIdx >= 0) {
      updateCart(cart.filter((_, idx) => idx !== i).map((x) => (x.key === next.key ? { ...x, qty: D(x.qty || 0).plus(next.qty).toString() } : x)));
    } else {
      updateCart(cart.map((x, idx) => (idx === i ? next : x)));
    }
  };

  const paid = (Object.values(pay) as string[]).reduce((s, v) => s.plus(D(v || 0)), D(0));
  const diff = totals.total.minus(paid);
  const debt = D(pay.debt || 0);

  const reset = () => {
    setCart([]); setPay({ cash: '', card: '', click: '', debt: '' }); setPayTouched(false); setCustomer({ name: '', phone: '', note: '' });
    searchRef.current?.focus();
  };

  const submit = async () => {
    if (!cart.length) return toast('error', t('Savat bo‘sh'));
    for (const l of cart) {
      const ok = parseQty(l.qty, isDecimalUnit(l.unitName));
      if (!ok || D(ok).lte(0)) return toast('error', isDecimalUnit(l.unitName) ? t('"{name}": miqdor noto‘g‘ri', { name: l.name }) : t('"{name}": {u} soni butun son bo‘lishi kerak', { name: l.name, u: l.unitName }));
      if (parseMoney(l.unitPrice) === null) return toast('error', t('"{name}": narx noto‘g‘ri', { name: l.name }));
    }
    if (!diff.isZero()) return toast('error', diff.gt(0) ? t('To‘lov yetarli emas: yana {s} so‘m kiriting', { s: fmtMoney(diff) }) : t('To‘lov savdo summasidan {s} so‘m ko‘p', { s: fmtMoney(diff.neg()) }));
    if (debt.gt(0) && !customer.name.trim()) return toast('error', t('Nasiya uchun xaridor ismini kiriting'));
    setBusy(true);
    const known = customers.find((c) => c.name.toLowerCase() === customer.name.trim().toLowerCase() && (c.phone ?? '') === customer.phone.trim());
    const payload = {
      id: uuid(),
      items: cart.map((l) => ({ productId: l.productId, unit: l.unit, qty: parseQty(l.qty, true)!, unitPrice: parseMoney(l.unitPrice)! })),
      payments: METHODS.filter(({ m }) => D(pay[m] || 0).gt(0)).map(({ m }) => ({ method: m, amount: D(pay[m]).toFixed(2) })),
      customer: customer.name.trim() ? { id: known?.id ?? uuid(), name: customer.name.trim(), phone: customer.phone.trim() || null } : null,
      note: customer.note.trim() || null,
    };
    try {
      const r = await submitOp('sale.create', payload);
      if (r.status === 'ok') { toast('ok', t('Savdo №{n} saqlandi', { n: r.result.number })); reset(); }
      else toast('error', r.error ?? t('Xato'));
    } finally {
      setBusy(false);
    }
  };

  const priceTag = (i: number, l: Line, label: string, value: string | null) => value && (
    <button className={`tag ${D(l.unitPrice || 0).eq(value) ? 'tag-blue' : ''}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => setLine(i, { unitPrice: plain(value) })}>
      {label} {fmtMoney(value)}
    </button>
  );

  return (
    <>
      <TopBar title={t('Savdo')} />
      <div className="page">
        <div className="pos-layout">
          <div className="card">
            <div className="card-pad">
              <div className="search">
                <Search size={17} />
                <input ref={searchRef} className="input" autoFocus placeholder={t('Nom, kod, kategoriya bo‘yicha qidirish (shtrix-kod skaneri ham ishlaydi)')} value={q}
                  onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onSearchKey} aria-label={t('Mahsulot qidirish')} />
              </div>
            </div>
            <div className="pos-results">
              {results.length === 0 && <Empty text={productsQ.isError ? t('Mahsulotlarni yuklab bo‘lmadi. Internetni tekshiring.') : productsQ.isLoading ? t('Yuklanmoqda...') : products.length ? t('Hech narsa topilmadi') : t('Mahsulotlar hali yo‘q')} />}
              {results.map((p, i) => (
                <div key={p.id} className={`pos-item ${i === sel ? 'sel' : ''}`} onClick={() => add(p)}>
                  {p.hasImage ? <ProductImage id={p.id} version={p.imageVersion} size={38} /> : <div className="thumb thumb-empty" style={{ width: 38, height: 38 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="name">{p.name}{D(p.stock).lte(0) && <ErrBadge />}</div>
                    <div className="small muted">{p.code ?? '—'} · {t('qoldiq')}: <span className={D(p.stock).lte(0) ? 'neg' : ''}>{fmtQty(p.stock)} {t(p.unit)}</span></div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Money v={p.price} /> <span className="small muted">/ {t(p.unit)}</span>
                    {p.discountPrice && <div className="small pos">{t('chegirma')}: {fmtMoney(p.discountPrice)}</div>}
                    {p.premiumPrice && <div className="small pos">{t('premium')}: {fmtMoney(p.premiumPrice)}</div>}
                    {p.altUnit && <div className="small muted">{fmtMoney(p.altPrice)} / {p.altUnit}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2><ShoppingCart size={18} style={{ verticalAlign: -3 }} /> {t('Savat')}</h2>
              {cart.length > 0 && <button className="btn btn-sm btn-ghost" onClick={reset}>{t('Tozalash')}</button>}</div>
            {cart.length === 0 ? <Empty text={t('Mahsulotni qidirib, savatga qo‘shing')} /> : (
              <div className="table-wrap">
                <table className="cart">
                  <thead><tr><th>{t('Mahsulot')}</th><th>{t('Miqdori')}</th><th className="r">{t('Narx (1 birlik)')}</th><th className="r">{t('Chegirma')}</th><th className="r">{t('Jami')}</th><th /></tr></thead>
                  <tbody>
                    {cart.map((l, i) => {
                      const p = byId.get(l.productId);
                      const qty = D(l.qty || 0);
                      const lineDisc = D(l.price).minus(l.unitPrice || 0).times(qty);
                      const belowCost = D(l.unitPrice || 0).lt(l.costPrice);
                      const decimal = isDecimalUnit(l.unitName);
                      return (
                        <tr key={l.key}>
                          <td>{l.name}{p && D(p.stock).lte(0) && <ErrBadge />}
                            {p?.altUnit && (
                              <div className="tabs" style={{ marginTop: 4, padding: 2 }}>
                                <button className={`tab ${l.unit === 'base' ? 'active' : ''}`} style={{ padding: '2px 10px' }} onClick={() => switchUnit(i, 'base')}>{t(p.unit)}</button>
                                <button className={`tab ${l.unit === 'alt' ? 'active' : ''}`} style={{ padding: '2px 10px' }} onClick={() => switchUnit(i, 'alt')}>{p.altUnit}</button>
                              </div>
                            )}
                            {l.unit === 'alt' && <div className="small muted">1 {l.unitName} = {fmtQty(l.factor)} {t(p?.unit ?? '')}</div>}
                            <div className="row small" style={{ gap: 4, marginTop: 3 }}>
                              {priceTag(i, l, t('Oddiy'), l.price)}
                              {priceTag(i, l, t('Chegirmali'), l.discountPrice)}
                              {priceTag(i, l, t('Premium'), l.premiumPrice)}
                            </div>
                          </td>
                          <td>
                            <div className="qty">
                              <button className="icon-btn" onClick={() => qty.gt(1) && setLine(i, { qty: qty.minus(1).toString() })} aria-label="−"><Minus size={14} /></button>
                              <input className="input input-sm" style={{ width: 64 }} value={l.qty.replace('.', ',')} inputMode={decimal ? 'decimal' : 'numeric'} aria-label={t('Miqdori')}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/\s/g, '').replace(',', '.');
                                  if (v === '' || (decimal ? /^\d{0,10}(\.\d{0,3})?$/ : /^\d{0,10}$/).test(v)) setLine(i, { qty: v });
                                }} />
                              <button className="icon-btn" onClick={() => setLine(i, { qty: qty.plus(1).toString() })} aria-label="+"><Plus size={14} /></button>
                            </div>
                            <div className="small muted" style={{ textAlign: 'center' }}>{t(l.unitName)}</div>
                          </td>
                          <td style={{ width: 150 }}>
                            <MoneyInput value={l.unitPrice} onChange={(v) => setLine(i, { unitPrice: v })} className="input-sm" ariaLabel={t('Sotuv narxi')} />
                            {belowCost && <div className="small neg">{t('Tannarxdan past!')}</div>}
                          </td>
                          <td className={`r small ${lineDisc.lt(0) ? 'pos' : lineDisc.gt(0) ? 'neg' : 'muted'}`}>
                            {lineDisc.isZero() ? '—' : lineDisc.gt(0) ? `−${fmtMoney(lineDisc)}` : `+${fmtMoney(lineDisc.neg())}`}
                          </td>
                          <td className="r"><Money v={D(l.unitPrice || 0).times(qty).toFixed(2)} /></td>
                          <td><button className="icon-btn" onClick={() => updateCart(cart.filter((_, idx) => idx !== i))} aria-label={t('O‘chirish')}><Trash2 size={16} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {cart.length > 0 && (
              <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--border)' }}>
                <div className="totals">
                  <span className="muted">{t('Jami narx (oddiy narxda)')}</span><span className="num">{fmtMoney(totals.base)}</span>
                  <span className="muted">{totals.discount.gte(0) ? t('Chegirma') : t('Narx farqi (qimmatroq sotildi)')}</span>
                  <span className={`num ${totals.discount.gt(0) ? 'neg' : totals.discount.lt(0) ? 'pos' : ''}`}>{totals.discount.gt(0) ? '−' : totals.discount.lt(0) ? '+' : ''}{fmtMoney(totals.discount.abs())}</span>
                  <span className="grand">{t('Yakuniy to‘lov summasi')}</span><span className="grand num">{fmtMoney(totals.total)} {t('so‘m')}</span>
                </div>

                <div>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <b>{t('To‘lov')}</b><span className="spacer" />
                    {METHODS.map(({ m, label }) => (
                      <button key={m} className="btn btn-sm" onClick={() => { setPayTouched(true); autoPay(totals.total.toFixed(2), m); }}>{t('Hammasi')}: {t(label)}</button>
                    ))}
                  </div>
                  <div className="pay-grid">
                    {METHODS.map(({ m, label }) => (
                      <PayRow key={m} label={t(label)} value={pay[m]} onChange={(v) => { setPayTouched(true); setPay({ ...pay, [m]: v }); }}
                        onRest={() => { setPayTouched(true); setPay({ ...pay, [m]: D(pay[m] || 0).plus(diff).gt(0) ? plain(D(pay[m] || 0).plus(diff).toFixed(2)) : '' }); }} restLabel={t('Qolganini')} />
                    ))}
                  </div>
                  {!diff.isZero() && <div className="small neg" style={{ marginTop: 6 }}>
                    {diff.gt(0) ? t('Taqsimlanmagan: {s} so‘m', { s: fmtMoney(diff) }) : t('Ortiqcha: {s} so‘m', { s: fmtMoney(diff.neg()) })}</div>}
                </div>

                {(debt.gt(0) || customer.name) && (
                  <div className="form-grid">
                    <Field label={t('Xaridor ismi') + (debt.gt(0) ? ' *' : '')}>
                      <input className="input" list="customers" value={customer.name} onChange={(e) => {
                        const c = customers.find((x) => x.name === e.target.value);
                        setCustomer({ ...customer, name: e.target.value, phone: c?.phone ?? customer.phone });
                      }} />
                      <datalist id="customers">{customers.map((c) => <option key={c.id} value={c.name}>{c.phone ?? ''}</option>)}</datalist>
                    </Field>
                    <Field label={t('Telefon raqami')}><input className="input" value={customer.phone} placeholder="+998" onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></Field>
                    <Field label={t('Izoh')}><input className="input" value={customer.note} onChange={(e) => setCustomer({ ...customer, note: e.target.value })} /></Field>
                  </div>
                )}
                <button className="btn btn-ok btn-lg" disabled={busy} onClick={submit}>{t('Savdoni yakunlash')} — {fmtMoney(totals.total)} {t('so‘m')}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** "100000.00" → "100000" (kiritish maydonida ortiqcha ,00 ko'rinmasin) */
const plain = (v: string) => D(v).toFixed(2).replace(/\.?0+$/, '');

function PayRow({ label, value, onChange, onRest, restLabel }: { label: string; value: string; onChange: (v: string) => void; onRest: () => void; restLabel: string }) {
  return (
    <>
      <span>{label}</span>
      <MoneyInput value={value} onChange={onChange} ariaLabel={label} />
      <button className="btn btn-sm btn-ghost" onClick={onRest}>{restLabel}</button>
    </>
  );
}
