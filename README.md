# hisob-platforma

Savdo va ombor boshqaruv platformasining frontend qismi (brauzer ilovasi). Backend: [hisob-platforma-bachand](https://github.com/f93142122-tech/hisob-platforma-bachand).

**Texnologiyalar:** React, TypeScript, Vite, TanStack Query, pdfmake (PDF hisobot).

## Imkoniyatlar

- Bosh sahifa, savdo (shtrix-kod skaneri bilan), mahsulotlar, ombor, nasiya, qaytarishlar, xarajatlar, doimiy xarajatlar, hisobotlar, kunni yakunlash (PDF bilan), sozlamalar
- Lotin va kirill interfeysi
- Faqat onlayn ishlaydi: barcha ma'lumotlar darhol serverga yoziladi

## Ishga tushirish

```powershell
npm install
npm run dev
```

Ishlab chiqish rejimida `/api` so'rovlari `http://localhost:3000` dagi backendga yo'naltiriladi.

## Production build

```powershell
npm run build
```

Natija `dist/` papkasiga yoziladi. Ikki xil joylash mumkin:

1. **Backend bilan birga (tavsiya etiladi):** backend `.env` faylida `WEB_DIST` ni shu `dist` papkasiga ko'rsating. Bunda server frontendni o'zi beradi.
2. **Alohida domenda:** build oldidan `VITE_API_URL=https://api.sizning-domen.uz` ni o'rnating, backendda esa `CORS_ORIGIN` ga frontend manzilini yozing.
