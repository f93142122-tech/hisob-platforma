import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Banknote, CreditCard, Smartphone, HandCoins, Receipt, TrendingUp, Package, PackageX, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { D, fmtDate, fmtMoney, fmtTime } from '../lib/money';
import { Empty, Money, payLabel } from '../lib/ui';
import { TopBar } from '../App';

export function Dashboard() {
  const { t } = useT();
  // Har 15 soniyada va har bir amaldan keyin avtomatik yangilanadi
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api<any>('/api/dashboard'), refetchInterval: 15_000 });
  const d = q.data;
  const s = d?.summary;

  return (
    <>
      <TopBar title={t('Bosh sahifa')}>{d && <span className="muted">{fmtDate(d.today)}</span>}</TopBar>
      <div className="page">
        {q.isError && !d && <div className="alert alert-warn">{t('Ma’lumotni yuklab bo‘lmadi. Internet aloqasini tekshiring.')}</div>}
        {d?.pendingRecurring > 0 && (
          <Link to="/doimiy-xarajatlar" className="alert alert-warn"><AlertTriangle size={16} />
            {t('{n} ta doimiy xarajatning muddati keldi — tasdiqlash kerak.', { n: d.pendingRecurring })}</Link>
        )}
        {s && (
          <>
            <div className="grid grid-2">
              <div className="card stat hero">
                <div className="label"><TrendingUp size={16} /> {t('Bugungi umumiy savdo summasi')}</div>
                <div className="value" style={{ fontSize: 30 }}>{fmtMoney(s.netSales)} <small>{t('so‘m')}</small></div>
                <div className="sub">{t('{n} ta savdo', { n: s.salesCount })}{D(s.returnsTotal).gt(0) ? ` · ${t('qaytarishlar')}: ${fmtMoney(s.returnsTotal)}` : ''}</div>
              </div>
              <div className={`card stat ${D(s.netProfit).lt(0) ? 'loss' : 'profit'}`}>
                <div className="label">{t('Bugungi sof foyda')}</div>
                <div className="value" style={{ fontSize: 30 }}>{fmtMoney(s.netProfit)} <small>{t('so‘m')}</small></div>
                <div className="sub">{t('Mahsulot foydasi')} {fmtMoney(s.productProfit)} − {t('xarajatlar')} {fmtMoney(s.expenses.total)}</div>
              </div>
            </div>
            <div className="grid grid-4">
              <Stat icon={<Banknote size={16} />} label={t('Naqd pul tushumi')} value={s.income.cash} />
              <Stat icon={<CreditCard size={16} />} label={t('Karta tushumi')} value={s.income.card} />
              <Stat icon={<Smartphone size={16} />} label={t('Click tushumi')} value={s.income.click} />
              <Stat icon={<HandCoins size={16} />} label={t('Nasiya savdolar')} value={s.debtSales} sub={`${t('Jami ochiq qarz')}: ${fmtMoney(d.openDebtTotal)}`} />
              <Stat icon={<Receipt size={16} />} label={t('Bugungi xarajatlar')} value={s.expenses.total}
                sub={`${t('oddiy')} ${fmtMoney(s.expenses.regular)} · ${t('doimiy')} ${fmtMoney(s.expenses.recurring)}`} />
              <Stat icon={<TrendingUp size={16} />} label={t('Mahsulotlardan jami foyda')} value={s.productProfit} sub={`${t('Berilgan chegirma')}: ${fmtMoney(s.discounts)}`} />
              <Stat icon={<Package size={16} />} label={t('Ombordagi mahsulotlar')} raw={`${d.stock.inStock}`} sub={t('{n} dona jami', { n: d.stock.units.toLocaleString('ru-RU') })} />
              <Link to="/ombor?tab=out" className="card stat">
                <div className="label"><PackageX size={16} /> {t('Tugagan mahsulotlar')}</div>
                <div className={`value ${d.stock.outOfStock ? 'neg' : ''}`}>{d.stock.outOfStock}</div>
                <div className="sub">{t('qoldig‘i 0 yoki undan kam')}</div>
              </Link>
            </div>
            <div className="grid grid-2">
              <div className="card">
                <div className="card-head"><h2>{t('So‘nggi savdolar')}</h2><Link to="/hisobotlar">{t('Barchasi')}</Link></div>
                {d.lastSales.length ? (
                  <table>
                    <thead><tr><th>№</th><th>{t('Vaqt')}</th><th>{t('Sotuvchi')}</th><th>{t('To‘lov')}</th><th className="r">{t('Summa')}</th></tr></thead>
                    <tbody>{d.lastSales.map((x: any) => (
                      <tr key={x.id}><td>{x.number}</td><td>{fmtTime(x.createdAt)}<div className="small muted">{fmtDate(x.createdAt)}</div></td><td>{x.sellerName}</td>
                        <td>{Object.keys(x.payments ?? {}).map((m) => <span key={m} className="tag" style={{ marginRight: 4 }}>{t(payLabel[m])}</span>)}</td>
                        <td className="r"><Money v={x.total} /></td></tr>
                    ))}</tbody>
                  </table>
                ) : <Empty text={t('Hali savdo yo‘q')} />}
              </div>
              <div className="card">
                <div className="card-head"><h2>{t('So‘nggi xarajatlar')}</h2><Link to="/xarajatlar">{t('Barchasi')}</Link></div>
                {d.lastExpenses.length ? (
                  <table>
                    <thead><tr><th>{t('Xarajat')}</th><th>{t('Kim kiritdi')}</th><th>{t('Sana')}</th><th className="r">{t('Summa')}</th></tr></thead>
                    <tbody>{d.lastExpenses.map((x: any) => (
                      <tr key={x.id}><td>{x.name}{x.note && <div className="small muted">{x.note}</div>}</td><td>{x.userName}</td><td>{fmtDate(x.expenseDate)}</td><td className="r"><Money v={x.amount} /></td></tr>
                    ))}</tbody>
                  </table>
                ) : <Empty text={t('Hali xarajat yo‘q')} />}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ icon, label, value, raw, sub }: { icon: React.ReactNode; label: string; value?: string; raw?: string; sub?: string }) {
  return (
    <div className="card stat">
      <div className="label">{icon} {label}</div>
      <div className="value">{raw ?? fmtMoney(value)}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
