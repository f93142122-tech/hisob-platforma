import { createContext, useContext } from 'react';
import type { User } from './api';

export const AuthContext = createContext<{ user: User; logout: () => void; setUser: (u: User) => void }>(null as any);
export const useAuth = () => useContext(AuthContext);
export const isAdmin = (u: User | null | undefined) => u?.role === 'admin';
