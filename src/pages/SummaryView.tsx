/** Hisobot ko'rinishi: Hisobotlar va Kunni yakunlash sahifalarida ishlatiladi. */
import { useT } from '../lib/i18n';
import { D, fmtMoney, fmtQty } from '../lib/money';
import { Empty, Money } from '../lib/ui';

export function SummaryCards({ s }: { s: any }) {
  const { t } = useT();
  const neg = D(s.netProfit).lt(0);
  return (
    <>
      <div className="grid grid-4">
        <div className="card stat hero"><div className="label">{t('Umumiy savdo')}</div><div className="value">{fmtMoney(s.netSales)}</div>
          <div className="sub">{t('{n} ta savdo', { n: s.salesCount })}{D(s.returnsTotal).gt(0) ? ` · ${t('qaytarish')} −${fmtMoney(s.returnsTotal)}` : ''}</div></div>
        <div className="card stat"><div className="label">{t('Jami mahsulot foydasi')}</div><div className="value pos">{fmtMoney(s.productProfit)}</div>
          <div className="sub">{t('Berilgan chegirmalar')}: {fmtMoney(s.discounts)}</div></div>
        <div className="card stat"><div className="label">{t('Xarajatlar')}</div><div className="value neg">{fmtMoney(s.expenses.total)}</div>
          <div className="sub">{t('oddiy')} {fmtMoney(s.expenses.regular)} · {t('tasdiqlangan doimiy')} {fmtMoney(s.expenses.recurring)}</div></div>
        <div className={`card stat ${neg ? 'loss' : 'profit'}`}><div className="label">{t('Sof foyda')}</div><div className="value">{fmtMoney(s.netProfit)}</div>
          <div className="sub">{t('foyda − xarajatlar')}</div></div>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h3>{t('Tushumlar')}</h3><span className="muted small">{t('haqiqatda olingan pul')}</span></div>
          <table>
            <thead><tr><th /><th className="r">{t('Savdodan')}</th><th className="r">{t('Nasiya to‘lovi')}</th><th className="r">{t('Qaytarilgan')}</th><th className="r">{t('Tushum')}</th></tr></thead>
            <tbody>
              {(['cash', 'card', 'click'] as const).map((m) => (
                <tr key={m}><td>{m === 'cash' ? t('Naqd') : m === 'card' ? t('Karta') : 'Click'}</td>
                  <td className="r"><Money v={s.salePayments[m]} /></td><td className="r"><Money v={s.debtRepayments[m]} /></td>
                  <td className="r neg">{D(s.refunds[m]).gt(0) ? '−' : ''}<Money v={s.refunds[m]} /></td><td className="r"><b><Money v={s.income[m]} /></b></td></tr>
              ))}
            </tbody>
            <tfoot><tr><td>{t('Jami')}</td><td /><td /><td /><td className="r"><Money v={s.income.total} /></td></tr></tfoot>
          </table>
        </div>
        <div className="card">
          <div className="card-head"><h3>{t('Nasiya')}</h3></div>
          <table><tbody>
            <tr><td>{t('Nasiya savdolar (hali olinmagan pul)')}</td><td className="r"><Money v={s.debtSales} /></td></tr>
            <tr><td>{t('Nasiya bo‘yicha olingan to‘lovlar')}</td><td className="r"><Money v={D(s.debtRepayments.cash).plus(s.debtRepayments.card).plus(s.debtRepayments.click).toFixed(2)} /></td></tr>
            <tr><td>{t('Qaytarish hisobiga kamaygan qarz')}</td><td className="r"><Money v={s.refunds.debtReduction} /></td></tr>
            <tr><td>{t('Kassadan to‘langan xarajatlar')}</td><td className="r"><Money v={s.cashExpenses} /></td></tr>
          </tbody></table>
        </div>
      </div>
    </>
  );
}

export function ProductsTable({ s }: { s: any }) {
  const { t } = useT();
  return (
    <div className="card">
      <div className="card-head"><h3>{t('Sotilgan mahsulotlar')}</h3></div>
      {s.products.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('Mahsulot')}</th><th className="r">{t('Sotilgan')}</th><th className="r">{t('Qaytarilgan')}</th><th className="r">{t('Sof miqdor')}</th><th className="r">{t('Tushum')}</th><th className="r">{t('Chegirma')}</th><th className="r">{t('Foyda')}</th></tr></thead>
            <tbody>{s.products.map((p: any) => (
              <tr key={p.productId}><td>{p.name}</td><td className="r">{fmtQty(p.soldQty)}</td><td className="r">{D(p.returnedQty).gt(0) ? fmtQty(p.returnedQty) : '—'}</td><td className="r"><b>{fmtQty(p.netQty)}</b> <span className="small muted">{t(p.unit)}</span></td>
                <td className="r"><Money v={p.revenue} /></td><td className="r"><Money v={p.discount} /></td><td className={`r ${D(p.profit).lt(0) ? 'neg' : ''}`}><Money v={p.profit} /></td></tr>
            ))}</tbody>
            <tfoot><tr><td>{t('Jami')}</td><td /><td /><td /><td className="r"><Money v={s.netSales} /></td><td className="r"><Money v={s.discounts} /></td><td className="r"><Money v={s.productProfit} /></td></tr></tfoot>
          </table>
        </div>
      ) : <Empty text={t('Bu davrda savdo yo‘q')} />}
    </div>
  );
}
