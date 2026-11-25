import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { D, fmtDateTime, fmtMoney, fmtQty, todayLocal, uuid } from '../lib/money';
import { isDecimalUnit } from '../lib/data';
import { submitOp } from '../lib/ops';
import { Empty, Field, Money, payLabel, useToast } from '../lib/ui';
import { TopBar } from '../App';

export function Returns() {
  const { t } = useT();
  const toast = useToast();
  const [num, setNum] = useState('');
  const [sale, setSale] = useState<any>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<'cash' | 'card' | 'click'>('cash');
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(todayLocal().slice(0, 8) + '01');
  const [to, setTo] = useState(todayLocal());

  const recent = useQuery({ queryKey: ['sales-today'], queryFn: () => api<any[]>(`/api/sales?from=${todayLocal()}&to=${todayLocal()}&limit=30`) });
  const history = useQuery({ queryKey: ['returns', from, to], queryFn: () => api<any[]>(`/api/returns?from=${from}&to=${to}`) });

  const load = async (n: string) => {
    if (!n.trim()) return;
    try {
      setSale(await api(`/api/sales/by-number/${encodeURIComponent(n.trim())}`));
    } catch (e: any) {
      toast('error', e.message);
      return;
    }
    setQty({}); setReason('');
  };
  const openSale = async (id: string) => {
    try { setSale(await api(`/api/sales/${id}`)); setQty({}); setReason(''); } catch (e: any) { toast('error', e.message); }
  };

  const items = sale?.items ?? [];
  const leftOf = (i: any) => D(i.qty).minus(i.returnedQty);
  const sel = items.filter((i: any) => D(qty[i.id] || 0).gt(0));
  const total = sel.reduce((s: any, i: any) => s.plus(D(i.unitPrice).times(qty[i.id])), D(0)).toDecimalPlaces(2);
  const allLeft = items.every((i: any) => D(qty[i.id] || 0).eq(leftOf(i)));

  const submit = async () => {
    if (!sel.length) return toast('error', t('Qaytariladigan mahsulot va sonini belgilang'));
    if (!reason.trim()) return toast('error', t('Qaytarish sababini yozing'));
    setBusy(true);
    const r = await submitOp('return.create', {
      id: uuid(), saleId: sale.id, reason: reason.trim(), refundMethod: method,
      items: sel.map((i: any) => ({ saleItemId: i.id, qty: D(qty[i.id]).toString() })),
    });
    setBusy(false);
    if (r.status === 'error') return toast('error', r.error!);
    const res = r.result;
    toast('ok', D(res.debtReduction).gt(0)
      ? t('Qaytarildi. Nasiya qarzi {d} so‘mga kamaydi, xaridorga {r} so‘m qaytariladi.', { d: fmtMoney(res.debtReduction), r: fmtMoney(res.refund) })
      : t('Qaytarildi. Xaridorga {r} so‘m qaytariladi.', { r: fmtMoney(res.refund) }));
    setSale(null); setNum('');
  };

  return (
    <>
      <TopBar title={t('Qaytarishlar')} />
      <div className="page">
        <div className="grid" style={{ gridTemplateColumns: 'minmax(300px, 1fr) 2fr' }}>
          <div className="card">
            <div className="card-head"><h2>{t('Savdoni topish')}</h2></div>
            <div className="card-pad">
              <form className="row" onSubmit={(e) => { e.preventDefault(); load(num); }}>
                <div className="search" style={{ flex: 1 }}><Search size={16} />
                  <input className="input" placeholder={t('Savdo raqami (№)')} inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))} /></div>
                <button className="btn btn-primary">{t('Topish')}</button>
              </form>
            </div>
            <div className="card-head" style={{ borderTop: '1px solid var(--border)' }}><h3>{t('Bugungi savdolar')}</h3></div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {(recent.data ?? []).map((s) => (
                <div key={s.id} className="pos-item" onClick={() => openSale(s.id)}>
                  <div style={{ flex: 1 }}><b>№{s.number}</b> <span className="small muted">{fmtDateTime(s.createdAt)}</span>
                    <div className="small muted">{s.itemCount} {t('xil mahsulot')} · {s.sellerName}</div></div>
                  <div className="r"><Money v={s.total} />{D(s.returnedTotal).gt(0) && <div className="small neg">−{fmtMoney(s.returnedTotal)}</div>}</div>
                </div>
              ))}
              {recent.data && !recent.data.length && <Empty text={t('Bugun savdo yo‘q')} />}
            </div>
          </div>

          <div className="card">
            {!sale ? <Empty text={t('Qaytarish uchun savdoni tanlang')} /> : (
              <>
                <div className="card-head">
                  <h2>{t('Savdo')} №{sale.number ?? '—'} <span className="small muted">{fmtDateTime(sale.createdAt)}</span></h2>
                  <div className="row small">{sale.payments.map((p: any) => <span key={p.method} className="tag">{t(payLabel[p.method])}: {fmtMoney(p.amount)}</span>)}</div>
                </div>
                <table>
                  <thead><tr><th>{t('Mahsulot')}</th><th className="r">{t('Sotilgan')}</th><th className="r">{t('Qaytarilgan')}</th><th className="r">{t('Narx')}</th><th style={{ width: 140 }}>{t('Qaytariladi')}</th></tr></thead>
                  <tbody>{items.map((i: any) => {
                    const left = leftOf(i);
                    const decimal = isDecimalUnit(i.unitName);
                    return (
                      <tr key={i.id || i.productId}>
                        <td>{i.productName}</td><td className="r">{fmtQty(i.qty)} <span className="small muted">{t(i.unitName)}</span></td><td className="r">{D(i.returnedQty).gt(0) ? fmtQty(i.returnedQty) : '—'}</td><td className="r"><Money v={i.unitPrice} /></td>
                        <td>{left.gt(0) ? (
                          <div className="row" style={{ gap: 6 }}>
                            <input className="input input-sm" style={{ width: 72, textAlign: 'center' }} inputMode={decimal ? 'decimal' : 'numeric'} value={(qty[i.id] ?? '0').replace('.', ',')}
                              onChange={(e) => {
                                const v = e.target.value.replace(/\s/g, '').replace(',', '.');
                                if (v !== '' && !(decimal ? /^\d{0,10}(\.\d{0,3})?$/ : /^\d{0,10}$/).test(v)) return;
                                setQty({ ...qty, [i.id]: v === '' ? '' : D(v || 0).gt(left) ? left.toString() : v });
                              }} />
                            <span className="small muted">/ {fmtQty(left)} {t(i.unitName)}</span>
                          </div>
                        ) : <span className="tag">{t('to‘liq qaytgan')}</span>}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
                <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="row">
                    <button className={`btn btn-sm ${allLeft ? 'btn-primary' : ''}`} onClick={() => setQty(Object.fromEntries(items.map((i: any) => [i.id, leftOf(i).toString()])))}>{t('To‘liq qaytarish (hammasi)')}</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setQty({})}>{t('Tozalash')}</button>
                    <span className="spacer" />
                    <span>{t('Qaytariladigan summa')}: <b className="num" style={{ fontSize: 17 }}>{fmtMoney(total)} {t('so‘m')}</b></span>
                  </div>
                  {sale.debtId && <div className="alert alert-info">{t('Bu nasiya savdo. Qaytarilgan summa avval qolgan nasiya qarzidan ayriladi, ortgani xaridorga qaytariladi.')}</div>}
                  <div className="form-grid">
                    <Field label={t('Qaytarish sababi') + ' *'}><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Masalan: o‘lchami to‘g‘ri kelmadi')} /></Field>
                    <Field label={t('Pul qanday qaytariladi')}>
                      <select className="input" value={method} onChange={(e) => setMethod(e.target.value as any)}>
                        <option value="cash">{t('Naqd (kassadan)')}</option><option value="card">{t('Kartaga')}</option><option value="click">Click</option>
                      </select>
                    </Field>
                  </div>
                  <div className="row-end"><button className="btn btn-danger" disabled={busy || total.lte(0)} onClick={submit}>{t('Qaytarishni tasdiqlash')}</button></div>
                </div>
                {sale.returns?.length > 0 && (
                  <div className="card-pad" style={{ borderTop: '1px solid var(--border)' }}>
                    <h3 style={{ marginBottom: 8 }}>{t('Bu savdo bo‘yicha oldingi qaytarishlar')}</h3>
                    {sale.returns.map((r: any) => <div key={r.id} className="small">{fmtDateTime(r.createdAt)} — {fmtMoney(r.total)} {t('so‘m')} · {r.reason} · {r.userName}</div>)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>{t('Qaytarishlar tarixi')}</h2>
            <div className="row"><input type="date" className="input" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} /><span>—</span><input type="date" className="input" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} /></div></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('Vaqt')}</th><th>{t('Savdo')}</th><th>{t('Turi')}</th><th>{t('Mahsulotlar')}</th><th>{t('Sabab')}</th><th>{t('Qaytarildi')}</th><th>{t('Kim')}</th><th className="r">{t('Summa')}</th></tr></thead>
              <tbody>{(history.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="small">{fmtDateTime(r.createdAt)}</td><td>№{r.saleNumber}</td>
                  <td><span className={`tag ${r.isFull ? 'tag-danger' : 'tag-warn'}`}>{r.isFull ? t('To‘liq') : t('Qisman')}</span></td>
                  <td className="small">{r.products}</td><td className="small">{r.reason}</td>
                  <td className="small">
                    {D(r.refundCash).gt(0) && <div>{t('Naqd')}: {fmtMoney(r.refundCash)}</div>}
                    {D(r.refundCard).gt(0) && <div>{t('Karta')}: {fmtMoney(r.refundCard)}</div>}
                    {D(r.refundClick).gt(0) && <div>Click: {fmtMoney(r.refundClick)}</div>}
                    {D(r.debtReduction).gt(0) && <div>{t('Nasiyadan')}: {fmtMoney(r.debtReduction)}</div>}
                  </td>
                  <td className="small">{r.userName}</td><td className="r"><Money v={r.total} /></td>
                </tr>
              ))}</tbody>
            </table>
            {history.data && !history.data.length && <Empty text={t('Qaytarishlar yo‘q')} />}
          </div>
        </div>
      </div>
    </>
  );
}
