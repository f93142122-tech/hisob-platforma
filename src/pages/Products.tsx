import { useMemo, useRef, useState } from 'react';
import { useBarcodeScanner } from '../lib/scanner';
import { searchProducts } from '../lib/search';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Archive, ArchiveRestore, ImagePlus, X } from 'lucide-react';
import { isDecimalUnit, useCategories, useProducts, type Product, type Unit } from '../lib/data';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { useAuth, isAdmin } from '../lib/auth';
import { D, fmtMoney, fmtQty, parseMoney, parseQty, uuid } from '../lib/money';
import { submitOp } from '../lib/ops';
import { Confirm, Empty, ErrBadge, Field, Modal, Money, MoneyInput, ProductImage, Tabs, resizeImage, useToast } from '../lib/ui';
import { TopBar } from '../App';

export const UNITS: { value: Unit; label: string }[] = [
  { value: 'dona', label: 'Dona' }, { value: 'kg', label: 'Kilogramm (kg)' }, { value: 'metr', label: 'Metr' },
];
const ALT_UNIT_SUGGESTIONS = ['qop', 'pachka', 'quti', 'rulon', 'yashik', 'blok', 'dona', 'kg', 'metr'];

export function Products() {
  const { t } = useT();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [edit, setEdit] = useState<Product | 'new' | null>(null);
  const [archive, setArchive] = useState<Product | null>(null);
  const toast = useToast();
  const qc = useQueryClient();

  const productsQ = useProducts();
  const products = productsQ.data ?? [];
  const categories = useCategories().data ?? [];
  const archived = useQuery({ queryKey: ['products-archived'], queryFn: () => api<Product[]>('/api/products?archived=1'), enabled: view === 'archived' });

  const list = useMemo(() => {
    const src = view === 'active' ? products : archived.data ?? [];
    return searchProducts(src.filter((p) => !cat || p.categoryId === cat), q);
  }, [products, archived.data, q, cat, view]);
  const outCount = products.filter((p) => D(p.stock).lte(0)).length;

  const doArchive = async (p: Product, value: boolean) => {
    const r = await submitOp('product.archive', { id: p.id, archived: value });
    if (r.status === 'error') toast('error', r.error!);
    else { toast('ok', value ? t('Mahsulot arxivga o‘tkazildi') : t('Mahsulot qayta tiklandi')); qc.invalidateQueries({ queryKey: ['products-archived'] }); }
    setArchive(null);
  };

  return (
    <>
      <TopBar title={t('Mahsulotlar')}>
        <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={16} /> {t('Yangi mahsulot')}</button>
      </TopBar>
      <div className="page">
        <div className="card">
          <div className="card-head">
            <div className="row" style={{ flex: 1 }}>
              <div className="search" style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
                <Search size={16} />
                <input className="input" placeholder={t('Nom, kod, kategoriya, birlik yoki izoh bo‘yicha qidirish')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              </div>
              <select className="input" style={{ width: 200 }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('Kategoriya')}>
                <option value="">{t('Barcha kategoriyalar')}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="row">
              <span className="muted small">{t('Jami: {n}', { n: products.length })} · <span className={outCount ? 'neg' : ''}>{t('tugagan: {n}', { n: outCount })}</span></span>
              <Tabs value={view} onChange={setView} items={[{ value: 'active', label: t('Faol') }, { value: 'archived', label: t('Arxiv') }]} />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th style={{ width: 52 }} /><th>{t('Mahsulot nomi')}</th><th>{t('Kategoriya')}</th><th>{t('Kod / artikul')}</th>
                <th className="r">{t('Tannarx')}</th><th className="r">{t('Sotuv narxi')}</th><th className="r">{t('Chegirmali narx')}</th>
                <th className="r">{t('Premium narx')}</th><th className="r">{t('Qoldiq')}</th><th />
              </tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>{p.hasImage ? <ProductImage id={p.id} version={p.imageVersion} /> : <div className="thumb thumb-empty" style={{ width: 40, height: 40 }} />}</td>
                    <td><b>{p.name}</b>
                      {p.altUnit && <div className="small muted">1 {p.altUnit} = {fmtQty(p.altFactor)} {t(p.unit)} · {fmtMoney(p.altPrice)}</div>}
                      {p.note && <div className="small muted">{p.note}</div>}</td>
                    <td>{p.categoryName ?? <span className="muted">—</span>}</td>
                    <td>{p.code ?? <span className="muted">—</span>}</td>
                    <td className="r"><Money v={p.costPrice} /></td>
                    <td className="r"><Money v={p.price} /> <span className="small muted">/ {t(p.unit)}</span></td>
                    <td className="r">{p.discountPrice ? <Money v={p.discountPrice} /> : <span className="muted">—</span>}</td>
                    <td className="r">{p.premiumPrice ? <Money v={p.premiumPrice} /> : <span className="muted">—</span>}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}><span className={`num ${D(p.stock).lte(0) ? 'neg' : ''}`}>{fmtQty(p.stock)}</span> <span className="small muted">{t(p.unit)}</span>{D(p.stock).lte(0) && <ErrBadge />}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      {view === 'active' && <button className="icon-btn" title={t('Tahrirlash')} onClick={() => setEdit(p)}><Pencil size={16} /></button>}
                      {isAdmin(user) && (view === 'active'
                        ? <button className="icon-btn" title={t('Arxivga o‘tkazish')} onClick={() => setArchive(p)}><Archive size={16} /></button>
                        : <button className="icon-btn" title={t('Qayta tiklash')} onClick={() => doArchive(p, false)}><ArchiveRestore size={16} /></button>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.length && <Empty text={q ? t('Hech narsa topilmadi') : t('Mahsulotlar yo‘q')} />}
          </div>
        </div>
      </div>
      {edit && <ProductForm product={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      {archive && (
        <Confirm title={t('Mahsulotni arxivlash')} danger confirmText={t('Arxivga o‘tkazish')} onClose={() => setArchive(null)} onConfirm={() => doArchive(archive, true)}
          text={t('"{name}" ro‘yxatdan olib tashlanadi va savdoda ko‘rinmaydi. Uning savdo va ombor tarixi saqlanib qoladi. Arxivdan qayta tiklash mumkin.', { name: archive.name })} />
      )}
    </>
  );
}

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const categories = useCategories().data ?? [];
  const allProducts = useProducts().data ?? [];
  const qc = useQueryClient();
  const [newCat, setNewCat] = useState<string | null>(null); // null — yangi kategoriya maydoni yopiq
  const [catBusy, setCatBusy] = useState(false);

  /** Shu oynaning o'zida yangi kategoriya yaratib, uni mahsulotga tanlaydi. */
  const createCategory = async () => {
    const name = (newCat ?? '').trim();
    if (!name) return toast('error', t('Kategoriya nomini kiriting'));
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) { setF((prev) => ({ ...prev, categoryId: existing.id })); setNewCat(null); return; }
    setCatBusy(true);
    try {
      const c = await api<{ id: string; name: string }>('/api/categories', { method: 'POST', body: { name } });
      qc.setQueryData(['categories'], (old: any[] | undefined) => [...(old ?? []), c].sort((a, b) => a.name.localeCompare(b.name)));
      qc.invalidateQueries({ queryKey: ['categories'] });
      setF((prev) => ({ ...prev, categoryId: c.id }));
      setNewCat(null);
      toast('ok', t('"{name}" kategoriyasi qo‘shildi', { name: c.name }));
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setCatBusy(false);
    }
  };
  const [f, setF] = useState({
    name: product?.name ?? '', categoryId: product?.categoryId ?? '', code: product?.code ?? '',
    unit: (product?.unit ?? 'dona') as Unit,
    costPrice: product ? stripZeros(product.costPrice) : '', price: product ? stripZeros(product.price) : '',
    discountPrice: product?.discountPrice ? stripZeros(product.discountPrice) : '',
    premiumPrice: product?.premiumPrice ? stripZeros(product.premiumPrice) : '',
    hasAlt: !!product?.altUnit, altUnit: product?.altUnit ?? '', altFactor: product?.altFactor ?? '',
    altPrice: product?.altPrice ? stripZeros(product.altPrice) : '',
    stock: '', note: product?.note ?? '',
  });
  const [image, setImage] = useState<string | null | undefined>(undefined); // undefined = o'zgarmagan
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [scanned, setScanned] = useState(false);

  // Skaner istalgan paytda ishlaydi: kursor qaysi maydonda bo'lmasin, kod "Kod" maydoniga tushadi
  useBarcodeScanner((code) => {
    setF((prev) => ({ ...prev, code }));
    setScanned(true);
    const dup = allProducts.find((x) => x.code?.toLowerCase() === code.toLowerCase() && x.id !== product?.id);
    setErr(dup ? t('Bu kod "{name}" mahsulotiga berilgan', { name: dup.name }) : null);
  }, true, codeRef);

  const unitLabel = t(f.unit);
  const margin = parseMoney(f.price) && parseMoney(f.costPrice) ? D(f.price).minus(f.costPrice) : null;
  const altFactorOk = parseQty(f.altFactor, true);
  const altMargin = f.hasAlt && altFactorOk && parseMoney(f.altPrice) && parseMoney(f.costPrice)
    ? D(f.altPrice).minus(D(f.costPrice).times(altFactorOk)) : null;

  const save = async () => {
    setErr(null);
    const cost = parseMoney(f.costPrice), price = parseMoney(f.price);
    const disc = f.discountPrice ? parseMoney(f.discountPrice) : null;
    const prem = f.premiumPrice ? parseMoney(f.premiumPrice) : null;
    if (!f.name.trim()) return setErr(t('Mahsulot nomini kiriting'));
    if (cost === null) return setErr(t('Tannarxni to‘g‘ri kiriting'));
    if (price === null) return setErr(t('Sotuv narxini to‘g‘ri kiriting'));
    if (f.discountPrice && disc === null) return setErr(t('Chegirmali narxni to‘g‘ri kiriting'));
    if (f.premiumPrice && prem === null) return setErr(t('Premium narxni to‘g‘ri kiriting'));

    let altUnit: string | null = null, altFactor: string | null = null, altPrice: string | null = null;
    if (f.hasAlt) {
      altUnit = f.altUnit.trim();
      altFactor = parseQty(f.altFactor, f.unit !== 'dona');
      altPrice = parseMoney(f.altPrice);
      if (!altUnit) return setErr(t('Ikkinchi birlik nomini kiriting (masalan: qop)'));
      if (altUnit.toLowerCase() === f.unit) return setErr(t('Ikkinchi birlik asosiy birlikdan farq qilishi kerak'));
      if (!altFactor || D(altFactor).lte(0)) return setErr(t('Nisbatni to‘g‘ri kiriting: 1 {a} = necha {u}', { a: altUnit, u: unitLabel }));
      if (altPrice === null) return setErr(t('Ikkinchi birlik narxini kiriting'));
    }

    const stock = f.stock ? parseQty(f.stock, isDecimalUnit(f.unit)) : '0';
    if (!product && stock === null) return setErr(f.unit === 'dona' ? t('Dona uchun miqdor butun son bo‘lishi kerak') : t('Qoldiq noto‘g‘ri'));
    const code = f.code.trim() || null;
    if (code) {
      const dup = allProducts.find((x) => x.code?.toLowerCase() === code.toLowerCase());
      if (dup && dup.id !== product?.id) return setErr(t('Bu kod "{name}" mahsulotiga berilgan', { name: dup.name }));
    }
    setBusy(true);
    try {
      let r;
      const data: Record<string, any> = {
        name: f.name.trim(), categoryId: f.categoryId || null, code, unit: f.unit, costPrice: cost, price,
        discountPrice: disc, premiumPrice: prem, altUnit, altFactor, altPrice, note: f.note.trim() || null,
      };
      if (!product) {
        r = await submitOp('product.create', { id: uuid(), ...data, stock, image: image ?? null });
      } else {
        const changes: Record<string, any> = {};
        const before: Record<string, any> = {};
        for (const [k, v] of Object.entries(data)) {
          const old = (product as any)[k] ?? null;
          const numeric = ['costPrice', 'price', 'discountPrice', 'premiumPrice', 'altPrice', 'altFactor'].includes(k);
          const same = numeric ? (old === null ? v === null : v !== null && D(old).eq(v)) : old === v;
          if (!same) { changes[k] = v; before[k] = old; }
        }
        if (image !== undefined) changes.image = image;
        if (!Object.keys(changes).length) return onClose();
        r = await submitOp('product.update', { id: product.id, baseVersion: product.version, before, changes });
      }
      if (r.status === 'ok') { toast('ok', t('Saqlandi')); onClose(); }
      else setErr(r.error ?? t('Xato'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={product ? t('Mahsulotni tahrirlash') : t('Yangi mahsulot')} onClose={onClose} wide footer={<>
      <button className="btn" onClick={onClose}>{t('Bekor qilish')}</button>
      <button className="btn btn-primary" disabled={busy} onClick={save}>{t('Saqlash')}</button>
    </>}>
      <div className="form-grid">
        <Field label={t('Mahsulot nomi') + ' *'}><input className="input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="field">
          <span className="field-label">{t('Kategoriya')}</span>
          {newCat === null ? (
            <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} aria-label={t('Kategoriya')}>
                <option value="">{categories.length ? '—' : t('Hali kategoriya yo‘q')}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" className="btn btn-sm" style={{ flexShrink: 0 }} onClick={() => setNewCat('')}><Plus size={14} /> {t('Yangi')}</button>
            </div>
          ) : (
            <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <input className="input" autoFocus value={newCat} placeholder={t('Yangi kategoriya nomi')} aria-label={t('Yangi kategoriya nomi')}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createCategory(); } if (e.key === 'Escape') { e.stopPropagation(); setNewCat(null); } }} />
              <button type="button" className="btn btn-sm btn-primary" style={{ flexShrink: 0 }} disabled={catBusy} onClick={createCategory}>{t('Qo‘shish')}</button>
              <button type="button" className="icon-btn" title={t('Bekor qilish')} onClick={() => setNewCat(null)}><X size={15} /></button>
            </div>
          )}
        </div>
        <Field label={t('Kod yoki artikul')} hint={scanned ? t('✓ Skanerdan o‘qildi') : t('Skanerni mahsulotga tuting — kod shu yerga o‘zi tushadi')}>
          <input ref={codeRef} className="input" value={f.code} style={scanned ? { borderColor: 'var(--ok)' } : undefined}
            onChange={(e) => { setScanned(false); setF({ ...f, code: e.target.value }); }} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} /></Field>
        <Field label={t('O‘lchov birligi') + ' *'} hint={t('Mahsulot nimada sotiladi: donada, kilogrammda yoki metrda')}>
          <select className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as Unit })}>
            {UNITS.map((u) => <option key={u.value} value={u.value}>{t(u.label)}</option>)}
          </select>
        </Field>
        {!product
          ? <Field label={`${t('Ombordagi boshlang‘ich miqdor')} (${unitLabel})`} hint={isDecimalUnit(f.unit) ? t('Kasr son kiritish mumkin, masalan 12,5') : undefined}>
              <input className="input" inputMode="decimal" value={f.stock} placeholder="0" onChange={(e) => setF({ ...f, stock: e.target.value.replace(/[^\d.,]/g, '') })} /></Field>
          : <Field label={`${t('Ombordagi miqdor')} (${unitLabel})`} hint={t('Miqdor faqat Ombor bo‘limida kirim yoki tuzatish orqali o‘zgaradi')}><input className="input" disabled value={fmtQty(product.stock)} /></Field>}
        <Field label={`${t('Tannarx')} (1 ${unitLabel}) *`}><MoneyInput value={f.costPrice} onChange={(v) => setF({ ...f, costPrice: v })} /></Field>
        <Field label={`${t('Oddiy sotuv narxi')} (1 ${unitLabel}) *`} hint={margin ? `${t('Foyda')} (1 ${unitLabel}): ${fmtMoney(margin)}` : undefined}><MoneyInput value={f.price} onChange={(v) => setF({ ...f, price: v })} /></Field>
        <Field label={t('Chegirmali narx')} hint={t('Ixtiyoriy')}><MoneyInput value={f.discountPrice} onChange={(v) => setF({ ...f, discountPrice: v })} /></Field>
        <Field label={t('Premium narx')} hint={t('Ixtiyoriy. Savdoda bir bosishda tanlanadi')}><MoneyInput value={f.premiumPrice} onChange={(v) => setF({ ...f, premiumPrice: v })} /></Field>

        <div className="full card card-pad" style={{ background: '#fafbfc', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: 'none' }}>
          <label className="check"><input type="checkbox" checked={f.hasAlt} onChange={(e) => setF({ ...f, hasAlt: e.target.checked })} />
            <b>{t('Ikkinchi birlikda ham sotiladi')}</b> <span className="muted small">{t('(masalan: sement kg da ham, qopda ham)')}</span></label>
          {f.hasAlt && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <Field label={t('Ikkinchi birlik nomi') + ' *'}>
                <input className="input" list="alt-units" value={f.altUnit} placeholder={t('qop')} onChange={(e) => setF({ ...f, altUnit: e.target.value })} />
                <datalist id="alt-units">{ALT_UNIT_SUGGESTIONS.filter((u) => u !== f.unit).map((u) => <option key={u} value={u} />)}</datalist>
              </Field>
              <Field label={`1 ${f.altUnit || t('qop')} = ? ${unitLabel} *`} hint={t('Nisbat: bitta ikkinchi birlikda nechta asosiy birlik bor')}>
                <input className="input" inputMode="decimal" value={f.altFactor} placeholder="50" onChange={(e) => setF({ ...f, altFactor: e.target.value.replace(/[^\d.,]/g, '') })} />
              </Field>
              <Field label={`${t('Narxi')} (1 ${f.altUnit || t('qop')}) *`} hint={altMargin ? `${t('Foyda')} (1 ${f.altUnit}): ${fmtMoney(altMargin)}` : undefined}>
                <MoneyInput value={f.altPrice} onChange={(v) => setF({ ...f, altPrice: v })} />
              </Field>
            </div>
          )}
        </div>

        <Field label={t('Rasm')} hint={t('Ixtiyoriy')}>
          <div className="row">
            {image ? <img src={image} className="thumb" style={{ width: 48, height: 48 }} alt="" />
              : image === undefined && product?.hasImage ? <ProductImage id={product.id} version={product.imageVersion} size={48} /> : null}
            <label className="btn btn-sm"><ImagePlus size={15} /> {t('Tanlash')}
              <input type="file" accept="image/*" hidden onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) try { setImage(await resizeImage(file)); } catch (er: any) { setErr(er.message); }
              }} />
            </label>
            {(image || (image === undefined && product?.hasImage)) && <button className="btn btn-sm btn-ghost" onClick={() => setImage(null)}><X size={14} /> {t('Olib tashlash')}</button>}
          </div>
        </Field>
        <Field label={t('Qo‘shimcha izoh')}><textarea className="input full" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
      {err && <div className="alert alert-danger">{err}</div>}
    </Modal>
  );
}

const stripZeros = (v: string) => v.replace(/\.00$/, '');
