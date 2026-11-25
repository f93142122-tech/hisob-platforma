/**
 * Shtrix-kod skanerini tanib olish.
 *
 * USB skaner (klaviatura rejimida) kodni juda tez "yozadi" va oxirida Enter bosadi.
 * Odam tugmalarni 80+ ms oraliqda bosadi, skaner esa 5–30 ms oraliqda.
 * Shu farq bo'yicha skanerdan kelgan kodni ajratib olamiz — kursor qaysi maydonda turganidan qat'i nazar.
 * Kod tasodifan boshqa maydonga (masalan, "Mahsulot nomi"ga) yozilib qolgan bo'lsa, u maydon avvalgi holatiga qaytariladi.
 */
import { useEffect, useRef } from 'react';

const MAX_GAP_MS = 50; // belgilar orasidagi eng katta vaqt (skaner uchun)
const MIN_LENGTH = 4; // eng qisqa shtrix-kod

type Field = HTMLInputElement | HTMLTextAreaElement;
const isField = (el: EventTarget | null): el is Field => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

/** React boshqaradigan maydon qiymatini to'g'ri usulda o'zgartiradi (state ham yangilanadi). */
function setFieldValue(el: Field, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * @param onScan skanerlangan kod bilan chaqiriladi
 * @param enabled false bo'lsa tinglamaydi
 * @param keepIn shu maydonga yozilgan kod o'chirilmaydi (masalan, "Kod" maydonining o'zi)
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true, keepIn?: React.RefObject<Field | null>) {
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let buf = '';
    let first = 0;
    let last = 0;
    let target: Field | null = null;
    let before = '';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const now = performance.now();
      if (e.key === 'Enter') {
        const fast = buf.length >= MIN_LENGTH && now - last <= MAX_GAP_MS * 2 && (last - first) / Math.max(buf.length - 1, 1) <= MAX_GAP_MS;
        if (fast) {
          e.preventDefault();
          e.stopPropagation();
          const code = buf;
          // Kod boshqa maydonga yozilib qolgan bo'lsa — o'sha maydonni avvalgi holatiga qaytaramiz
          if (target && target !== keepIn?.current && target.isConnected) setFieldValue(target, before);
          buf = '';
          cb.current(code);
        } else {
          buf = '';
        }
        return;
      }
      if (e.key.length !== 1) return; // Shift, Tab va h.k.
      if (now - last > MAX_GAP_MS || !buf) {
        // Yangi ketma-ketlik boshlandi
        buf = '';
        first = now;
        target = isField(e.target) ? e.target : null;
        before = target ? target.value : '';
      }
      buf += e.key;
      last = now;
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, keepIn]);
}
