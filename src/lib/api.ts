/** Server bilan aloqa. Kirish tokeni brauzerda saqlanadi. */

/** Server manzili. Bo'sh bo'lsa — frontend bilan bir xil manzil (server frontendni o'zi ham beradi). */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const TOKEN_KEY = 'savdo.token';
const USER_KEY = 'savdo.user';

export interface User { id: string; username: string; fullName: string; role: 'admin' | 'seller'; script: 'latn' | 'cyrl'; active: boolean }

export const session = {
  get token() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  get user(): User | null { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } },
  set(token: string, user: User) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); },
  setUser(user: User) { localStorage.setItem(USER_KEY, JSON.stringify(user)); },
  clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
};

/** Server javob bermadi (internet yo'q yoki server o'chiq). */
export class NetworkError extends Error { constructor() { super('Server bilan aloqa yo‘q'); } }
export class ApiError extends Error { constructor(public status: number, message: string, public code?: string) { super(message); } }

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? 'GET',
      headers: { ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new NetworkError();
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) throw new NetworkError();
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && session.token && path !== '/api/auth/login') onUnauthorized();
    throw new ApiError(res.status, data?.error ?? `Xato (${res.status})`, data?.code);
  }
  return data as T;
}

export const isNetworkError = (e: unknown) => e instanceof NetworkError;
