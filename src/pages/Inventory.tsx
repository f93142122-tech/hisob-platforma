import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PackagePlus, SlidersHorizontal } from 'lucide-react';
import { isDecimalUnit, useProducts, type Product } from '../lib/data';
import { searchProducts } from '../lib/search';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { D, fmtDateTime, fmtQty, uuid } from '../lib/money';
import { submitOp } from '../lib/ops';
import { Empty, ErrBadge, Field, Modal, Tabs, useToast } from '../lib/ui';
import { TopBar } from '../App';

const typeLabel: Record<string, string> = { initial: 'Boshlang‘ich', receipt: 'Kirim', sale: 'Savdo', return: 'Qaytarish', adjustment: 'Tuzatish' };

export function Inventory() {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'stock' | 'out' | 'history') || 'stock';
  const [modal, setModal] = useState<{ kind: 'receipt' | 'adjust'; product?: Product } | null>(null);
  const [q, setQ] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const products = useProducts().data ?? [];
  const out = products.filter((p) => D(p.stock).lte(0));
  const shown = useMemo(() => {
    const src = tab === 'out' ? out : products;
    return searchProducts(src, q);
  }, [products, q, tab]);

  const history = useQuery({
    queryKey: ['movements', productFilter, typeFilter],
    queryFn: () => api<any[]>(`/api/inventory/movements?limit=500${productFilter ? `&productId=${productFilter}` : ''}${typeFilter ? `&type=${typeFilter}` : ''}`),
    enabled: tab === 'history',
  });

  return (
    <>
      <TopBar title={t('Ombor')}>
        <button className="btn" onClick={() => setModal({ kind: 'adjust' })}><SlidersHorizontal size={16} /> {t('Qoldiqni tuzatish')}</button>
        <button className="btn btn-primary" onClick={() => setModal({ kind: 'receipt' })}><PackagePlus size={16} /> {t('Kirim qilish')}</button>
      </TopBar>
      <div className="page">
        <div className="card">
          <div className="card-head">
            <Tabs value={tab} onChange={(v) => setParams({ tab: v })} items={[
              { value: 'stock', label: t('Qoldiqlar') }, { value: 'out', label: `${t('Tugaganlar')} (${out.length})` }, { value: 'history', label: t('Harakatlar tarixi') },
            ]} />
            {tab !== 'history' ? (
              <input className="input" style={{ maxWidth: 320 }} placeholder={t('Nom, kod, kategoriya, birlik yoki izoh bo‘yicha qidirish')} value={q} onChange={(e) => setQ(e.target.value)} />
            ) : (
              <div className="row">
                <select className="input" style={{ width: 240 }} value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                  <option value="">{t('Barcha mahsulotlar')}</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="input" style={{ width: 170 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="">{t('Barcha turlar')}</option>
                  {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                </select>
              </div>
            )}
          </div>
          {tab !== 'history' ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>{t('Mahsulot')}</th><th>{t('Kod')}</th><th>{t('Kategoriya')}</th><th className="r">{t('Qoldiq')}</th><th /></tr></thead>
                <tbody>{shown.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b></td><td>{p.code ?? '—'}</td><td>{p.categoryName ?? '—'}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}><span className={`num ${D(p.stock).lte(0) ? 'neg' : ''}`}>{fmtQty(p.stock)}</span> <span className="small muted">{t(p.unit)}</span>{D(p.stock).lte(0) && <ErrBadge />}</td>
                    <td className="r">
                      <button className="btn btn-sm" onClick={() => setModal({ kind: 'receipt', product: p })}>{t('Kirim')}</button>{' '}
                      <button className="btn btn-sm btn-ghost" onClick={() => setModal({ kind: 'adjust', product: p })}>{t('Tuzatish')}</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
              {!shown.length && <Empty text={tab === 'out' ? t('Tugagan mahsulot yo‘q') : t('Mahsulotlar yo‘q')} />}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>{t('Vaqt')}</th><th>{t('Mahsulot')}</th><th>{t('Turi')}</th><th className="r">{t('O‘zgarish')}</th><th>{t('Sabab / izoh')}</th><th>{t('Kim')}</th></tr></thead>
                <tbody>{(history.data ?? []).map((m) => (
                  <tr key={m.id}>
                    <td className="small">{fmtDateTime(m.createdAt)}</td><td>{m.productName}</td>
                    <td><span className={`tag ${D(m.delta).gt(0) ? 'tag-ok' : 'tag-warn'}`}>{t(typeLabel[m.type] ?? m.type)}</span>{m.saleNumber ? <span className="small muted"> №{m.saleNumber}</span> : null}</td>
                    <td className={`r num ${D(m.delta).gt(0) ? 'pos' : 'neg'}`}>{D(m.delta).gt(0) ? '+' : ''}{fmtQty(m.delta)} <span className="small muted">{t(m.unit)}</span></td>
                    <td className="small">{m.note ?? ''}</td><td className="small">{m.userName}</td>
                  </tr>
                ))}</tbody>
              </table>
              {history.isError && <div className="alert alert-warn" style={{ margin: 12 }}>{t('Tarixni ko‘rish uchun internet kerak')}</div>}
              {history.data && !history.data.length && <Empty text={t('Harakatlar yo‘q')} />}
            </div>
          )}
        </div>
      </div>
      {modal && <StockModal kind={modal.kind} initial={modal.product} products={products} onClose={() => setModal(null)} />}
    </>
  );
}

function StockModal({ kind, initial, products, onClose }: { kind: 'receipt' | 'adjust'; initial?: Product; products: Product[]; onClose: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const [productId, setProductId] = useState(initial?.id ?? '');
  const [qty, setQty] = useState('');
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'count' | 'delta'>('count');
  const [busy, setBusy] = useState(false);
  const p = products.find((x) => x.id === productId);
  const decimal = isDecimalUnit(p?.unit);
  const unitLabel = p ? t(p.unit) : '';

  // Kiritilgan matnni son sifatida o'qiydi (vergul ham qabul qilinadi, manfiy bo'lishi mumkin). Noto'g'ri bo'lsa null.
  const num = (s: string, allowNeg: boolean) => {
    const v = s.replace(/\s/g, '').replace(',', '.');
    const re = decimal ? /^-?\d{1,10}(\.\d{1,3})?$/ : /^-?\d{1,10}$/;
    if (!v || !re.test(v) || (!allowNeg && v.startsWith('-'))) return null;
    return D(v);
  };
  const delta = kind === 'receipt' ? num(qty, false)
    : mode === 'count' ? (p && num(counted, true) ? num(counted, true)!.minus(p.stock) : null) : num(qty, true);

  const save = async () => {
    if (!p) return toast('error', t('Mahsulotni tanlang'));
    if (!delta) return toast('error', decimal ? t('Miqdorni to‘g‘ri kiriting') : t('Dona uchun miqdor butun son bo‘lishi kerak'));
    if (delta.isZero()) return toast('error', t('O‘zgarish yo‘q: miqdor bir xil'));
    if (kind === 'receipt' && delta.lte(0)) return toast('error', t('Kirim miqdori musbat bo‘lishi kerak'));
    if (kind === 'adjust' && !note.trim()) return toast('error', t('Tuzatish sababini yozing'));
    setBusy(true);
    const r = await submitOp(kind === 'receipt' ? 'stock.receipt' : 'stock.adjust', { id: uuid(), productId: p.id, qty: delta.toString(), note: note.trim() || null });
    setBusy(false);
    if (r.status === 'error') return toast('error', r.error!);
    toast('ok', t('Saqlandi'));
    onClose();
  };

  const clean = (v: string) => v.replace(decimal ? /[^\d.,-]/g : /[^\d-]/g, '');

  return (
    <Modal title={kind === 'receipt' ? t('Omborga kirim') : t('Qoldiqni tuzatish')} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>{t('Bekor qilish')}</button>
      <button className="btn btn-primary" disabled={busy} onClick={save}>{t('Saqlash')}</button>
    </>}>
      <Field label={t('Mahsulot')}>
        <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)} autoFocus={!initial}>
          <option value="">{t('Tanlang')}</option>
          {products.map((x) => <option key={x.id} value={x.id}>{x.name}{x.code ? ` (${x.code})` : ''} — {fmtQty(x.stock)} {t(x.unit)}</option>)}
        </select>
      </Field>
      {p && <div className="muted">{t('Hozirgi qoldiq')}: <b className={D(p.stock).lte(0) ? 'neg' : ''}>{fmtQty(p.stock)} {unitLabel}</b>
        {p.altUnit && <span className="small"> · 1 {p.altUnit} = {fmtQty(p.altFactor)} {unitLabel}</span>}</div>}
      {kind === 'receipt' ? (
        <Field label={`${t('Kelgan miqdor')}${unitLabel ? ` (${unitLabel})` : ''}`} hint={decimal ? t('Kasr son kiritish mumkin, masalan 12,5') : undefined}>
          <input className="input" inputMode="decimal" autoFocus={!!initial} value={qty} onChange={(e) => setQty(clean(e.target.value).replace('-', ''))} /></Field>
      ) : (
        <>
          <Tabs value={mode} onChange={setMode} items={[{ value: 'count', label: t('Sanalgan haqiqiy miqdor') }, { value: 'delta', label: t('Farq (+/−)') }]} />
          {mode === 'count'
            ? <Field label={`${t('Haqiqatda mavjud miqdor')}${unitLabel ? ` (${unitLabel})` : ''}`} hint={delta ? `${t('O‘zgarish')}: ${delta.gt(0) ? '+' : ''}${fmtQty(delta)} ${unitLabel}` : undefined}>
                <input className="input" inputMode="decimal" value={counted} onChange={(e) => setCounted(clean(e.target.value))} /></Field>
            : <Field label={`${t('Farq (masalan, −2 yoki 3)')}${unitLabel ? ` (${unitLabel})` : ''}`}><input className="input" value={qty} onChange={(e) => setQty(clean(e.target.value))} /></Field>}
        </>
      )}
      <Field label={kind === 'adjust' ? t('Sabab') + ' *' : t('Izoh')}><input className="input" value={note} placeholder={kind === 'receipt' ? t('Masalan: yetkazib beruvchidan') : t('Masalan: inventarizatsiya, shikastlangan')} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}
