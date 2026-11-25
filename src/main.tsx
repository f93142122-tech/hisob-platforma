import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ToastProvider } from './lib/ui';
import { isNetworkError } from './lib/api';
import { removeLegacyOfflineData } from './lib/data';
import './styles.css';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      retry: (n, e) => !isNetworkError(e) && n < 1,
      networkMode: 'always',
    },
  },
});

// Platforma faqat onlayn ishlaydi: oldingi versiyadan brauzerda qolgan offline nusxalarni tozalaymiz
removeLegacyOfflineData();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
