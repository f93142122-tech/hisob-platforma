import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { D, fmtDate, fmtDateTime, fmtMoney, monthRange, todayLocal } from '../lib/money';
import { Empty, Money, Tabs, payLabel } from '../lib/ui';
import { TopBar } from '../App';
import { ProductsTable, SummaryCards } from './SummaryView';

export function Reports() {
  const { t } = useT();
  const today = todayLocal();
  const [mode, setMode] = useState<'day' | 'month' | 'range'>('day');
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [range, setRange] = useState({ from: today.slice(0, 8) + '01', to: today });

  const { from, to } = mode === 'day' ? { from: day, to: day } : mode === 'month' ? monthRange(month) : range;
  const s = useQuery({ queryKey: ['report', from, to], queryFn: () => api<any>(`/api/reports/summary?from=${from}&to=${to}`) });
  const daily = useQuery({ queryKey: ['report-daily', from, to], queryFn: () => api<any[]>(`/api/reports/daily?from=${from}&to=${to <= today ? to : today}`), enabled: mode === 'month' });
  const sales = useQuery({ queryKey: ['report-sales', from, to], queryFn: () => api<any[]>(`/api/sales?from=${from}&to=${to}&limit=500`), enabled: mode === 'day' });

  return (
    <>
      <TopBar title={t('Hisobotlar')} />
      <div className="page">
        <div className="card card-pad row">
          <Tabs value={mode} onChange={setMode} items={[{ value: 'day', label: t('Kunlik') }, { value: 'month', label: t('Oylik') }, { value: 'range', label: t('Sana oralig‘i') }]} />
          {mode === 'day' && <input type="date" className="input" style={{ width: 170 }} value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />}
          {mode === 'month' && <input type="month" className="input" style={{ width: 170 }} value={month} max={today.slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} />}
          {mode === 'range' && <>
            <input type="date" className="input" style={{ width: 170 }} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /><span>—</span>
            <input type="date" className="input" style={{ width: 170 }} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </>}
          <span className="muted">{fmtDate(from)}{from !== to ? ` — ${fmtDate(to)}` : ''}</span>
        </div>
        {s.isError && <div className="alert alert-warn">{(s.error as any)?.message ?? t('Hisobotni yuklab bo‘lmadi')}</div>}
        {s.data && (
          <>
            <SummaryCards s={s.data} />
            {mode === 'month' && daily.data && (
              <div className="card">
                <div className="card-head"><h3>{t('Kunlar bo‘yicha')}</h3></div>
                <div className="table-wrap"><table>
                  <thead><tr><th>{t('Sana')}</th><th className="r">{t('Savdolar soni')}</th><th className="r">{t('Savdo')}</th><th className="r">{t('Mahsulot foydasi')}</th><th className="r">{t('Xarajatlar')}</th><th className="r">{t('Sof foyda')}</th></tr></thead>
                  <tbody>{daily.data.filter((d) => d.salesCount > 0 || D(d.expenses).gt(0)).map((d) => (
                    <tr key={d.date} className="clickable" onClick={() => { setDay(d.date); setMode('day'); }}>
                      <td>{fmtDate(d.date)}</td><td className="r">{d.salesCount}</td><td className="r"><Money v={d.netSales} /></td><td className="r"><Money v={d.productProfit} /></td>
                      <td className="r"><Money v={d.expenses} /></td><td className={`r ${D(d.netProfit).lt(0) ? 'neg' : 'pos'}`}><Money v={d.netProfit} /></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              </div>
            )}
            <ProductsTable s={s.data} />
            {mode === 'day' && (
              <div className="card">
                <div className="card-head"><h3>{t('Savdolar')}</h3></div>
                {sales.data?.length ? (
                  <div className="table-wrap"><table>
                    <thead><tr><th>№</th><th>{t('Vaqt')}</th><th>{t('Sotuvchi')}</th><th>{t('Xaridor')}</th><th>{t('To‘lov')}</th><th className="r">{t('Qaytarilgan')}</th><th className="r">{t('Summa')}</th></tr></thead>
                    <tbody>{sales.data.map((x) => (
                      <tr key={x.id}><td>{x.number}</td><td>{fmtDateTime(x.createdAt)}</td><td>{x.sellerName}</td><td>{x.customerName ?? '—'}</td>
                        <td className="small">{Object.entries(x.payments ?? {}).map(([k, v]) => `${t(payLabel[k])}: ${fmtMoney(v as string)}`).join(', ')}</td>
                        <td className="r">{D(x.returnedTotal).gt(0) ? <Money v={x.returnedTotal} className="neg" /> : '—'}</td><td className="r"><Money v={x.total} /></td></tr>
                    ))}</tbody>
                  </table></div>
                ) : <Empty text={t('Bu kunda savdo yo‘q')} />}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
