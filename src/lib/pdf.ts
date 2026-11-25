/** Kunlik savdo hisobotini PDF qilib yuklab beradi (pdfmake, faqat kerak bo'lganda yuklanadi). */
import type { T } from './i18n';
import { D, fmtDate, fmtDateTime, fmtMoney, fmtQty } from './money';

let pdfMakePromise: Promise<any> | null = null;
async function getPdfMake() {
  if (!pdfMakePromise) {
    pdfMakePromise = Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]).then(([pm, fonts]: any[]) => {
      const pdfMake = pm.default ?? pm;
      const f = fonts.default ?? fonts;
      pdfMake.vfs = f?.pdfMake?.vfs ?? f?.vfs ?? f;
      return pdfMake;
    });
  }
  return pdfMakePromise;
}

const m = (v: any) => ({ text: fmtMoney(v), alignment: 'right' as const });

export async function downloadClosingPdf(closing: any, expenses: any[], t: T) {
  const pdfMake = await getPdfMake();
  const s = closing.summary;
  const diff = D(closing.difference);
  const row = (label: string, value: any, bold = false) => [{ text: label, bold }, { ...m(value), bold }];

  const doc = {
    pageSize: 'A4',
    pageMargins: [36, 40, 36, 40],
    defaultStyle: { font: 'Roboto', fontSize: 9.5 },
    info: { title: `${t('Kunlik savdo hisoboti')} ${closing.date}` },
    footer: (page: number, pages: number) => ({ text: `${page} / ${pages}`, alignment: 'center', fontSize: 8, color: '#888', margin: [0, 10, 0, 0] }),
    content: [
      { text: t('Kunlik savdo hisoboti'), fontSize: 17, bold: true },
      { text: `${fmtDate(closing.date)} · ${t('Yopdi')}: ${closing.closedByName} · ${fmtDateTime(closing.closedAt)}`, color: '#555', margin: [0, 3, 0, 14] },
      {
        columns: [
          {
            width: '*', table: {
              widths: ['*', 'auto'], body: [
                [{ text: t('Savdo va foyda'), bold: true, colSpan: 2, fillColor: '#eef2f7' }, {}],
                row(t('Jami savdo summasi'), s.grossSales),
                row(t('Qaytarishlar'), s.returnsTotal),
                row(t('Sof savdo summasi'), s.netSales, true),
                row(t('Berilgan chegirmalar'), s.discounts),
                row(t('Mahsulotlardan jami foyda'), s.productProfit, true),
                row(t('Oddiy xarajatlar'), s.expenses.regular),
                row(t('Tasdiqlangan doimiy xarajatlar'), s.expenses.recurring),
                [{ text: t('Sof foyda'), bold: true, fontSize: 11 }, { ...m(s.netProfit), bold: true, fontSize: 11, color: D(s.netProfit).lt(0) ? '#c4321c' : '#0e7a55' }],
              ],
            }, layout: 'lightHorizontalLines',
          },
          { width: 16, text: '' },
          {
            width: '*', table: {
              widths: ['*', 'auto'], body: [
                [{ text: t('Tushumlar'), bold: true, colSpan: 2, fillColor: '#eef2f7' }, {}],
                row(t('Naqd pul tushumi'), s.income.cash),
                row(t('Karta tushumi'), s.income.card),
                row(t('Click tushumi'), s.income.click),
                row(t('Jami tushum'), s.income.total, true),
                row(t('Nasiya savdolar (olinmagan)'), s.debtSales),
                [{ text: t('Kassa'), bold: true, colSpan: 2, fillColor: '#eef2f7' }, {}],
                row(t('Kun boshidagi kassa'), closing.openingCash),
                row(t('Kassadan to‘langan xarajatlar'), s.cashExpenses),
                row(t('Tizim bo‘yicha kassa qoldig‘i'), closing.expectedCash, true),
                row(t('Kassadagi haqiqiy pul'), closing.actualCash, true),
                [{ text: diff.isZero() ? t('Farq yo‘q') : diff.gt(0) ? t('Ortiqcha') : t('Kamomad'), bold: true }, { ...m(diff.abs()), bold: true, color: diff.isZero() ? '#333' : diff.gt(0) ? '#0e7a55' : '#c4321c' }],
              ],
            }, layout: 'lightHorizontalLines',
          },
        ],
      },
      { text: t('Sotilgan mahsulotlar'), bold: true, fontSize: 12, margin: [0, 18, 0, 6] },
      s.products.length ? {
        table: {
          headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [t('Mahsulot'), t('Sotilgan'), t('Qaytarilgan'), t('Tushum'), t('Chegirma'), t('Foyda')].map((h) => ({ text: h, bold: true, fillColor: '#eef2f7' })),
            ...s.products.map((p: any) => [p.name, { text: `${fmtQty(p.soldQty)} ${t(p.unit)}`, alignment: 'right' }, { text: fmtQty(p.returnedQty), alignment: 'right' }, m(p.revenue), m(p.discount), m(p.profit)]),
          ],
        }, layout: 'lightHorizontalLines',
      } : { text: t('Savdo bo‘lmagan'), color: '#777' },
      { text: t('Xarajatlar'), bold: true, fontSize: 12, margin: [0, 18, 0, 6] },
      expenses.length ? {
        table: {
          headerRows: 1, widths: ['*', 'auto', '*', 'auto'],
          body: [
            [t('Xarajat'), t('Kim kiritdi'), t('Izoh'), t('Summa')].map((h) => ({ text: h, bold: true, fillColor: '#eef2f7' })),
            ...expenses.map((e: any) => [e.name + (e.recurringId ? ` (${t('doimiy')})` : ''), e.userName, e.note ?? '', m(e.amount)]),
          ],
        }, layout: 'lightHorizontalLines',
      } : { text: t('Xarajat bo‘lmagan'), color: '#777' },
      closing.note ? { text: `${t('Izoh')}: ${closing.note}`, margin: [0, 14, 0, 0] } : '',
    ],
  };
  pdfMake.createPdf(doc).download(`hisobot-${closing.date}.pdf`);
}
