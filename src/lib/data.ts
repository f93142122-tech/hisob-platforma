/** Serverdan olinadigan umumiy ma'lumotlar: mahsulotlar, kategoriyalar, mijozlar. */
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export type Unit = 'dona' | 'kg' | 'metr';
export interface Product {
  id: string; name: string; categoryId: string | null; categoryName: string | null; code: string | null;
  costPrice: string; price: string; discountPrice: string | null; premiumPrice: string | null;
  /** Qoldiq asosiy birlikda, matn ko'rinishida ("2.5") — kasr bo'lishi mumkin */
  stock: string; unit: Unit;
  /** Ikkinchi birlik (masalan "qop"): 1 altUnit = altFactor × unit, narxi altPrice */
  altUnit: string | null; altFactor: string | null; altPrice: string | null;
  note: string | null; hasImage: boolean; imageVersion: number; version: number; archived: boolean; updatedAt?: string;
}

/** Kasr miqdorga ruxsat beriladigan birliklar */
export const isDecimalUnit = (u: string | null | undefined) => ['kg', 'metr'].includes((u ?? '').toLowerCase());
export interface Category { id: string; name: string }
export interface Customer { id: string; name: string; phone: string | null }

export const useProducts = () => useQuery({ queryKey: ['products'], queryFn: () => api<Product[]>('/api/products') });
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/api/categories') });
export const useCustomers = () => useQuery({ queryKey: ['customers'], queryFn: () => api<Customer[]>('/api/customers') });

/** Oldingi versiyadan qolgan offline nusxalarni (IndexedDB, service worker, kesh) brauzerdan o'chiradi. */
export async function removeLegacyOfflineData() {
  try {
    if ('serviceWorker' in navigator) {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    }
    if ('caches' in window) {
      for (const k of await caches.keys()) await caches.delete(k);
    }
    if ('indexedDB' in window) indexedDB.deleteDatabase('savdo-platforma');
  } catch {
    /* brauzer ruxsat bermasa — muhim emas */
  }
}
