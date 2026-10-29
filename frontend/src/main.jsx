import { StrictMode } from'react'
import { createRoot } from'react-dom/client'
import'./index.css'
import App from'./App.jsx'
import { QueryClient, QueryClientProvider } from'@tanstack/react-query';
import { Toaster } from'react-hot-toast';
import ErrorBoundary from'./components/Common/ErrorBoundary.jsx';

import { Provider } from'react-redux';
import { store } from'./store';
import { attendanceOfflineService } from './services/attendanceOfflineService';
import { financeOfflineService } from './services/financeOfflineService';
import { runFullCleanup } from './db/db';
import { ThemeProvider, useTheme } from './ThemeContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 daqiqa
      gcTime: 1000 * 60 * 60 * 24, // 24 soat xotirada keshni saqlash
      retry: (failureCount) => {
        // Tarmoq uzilgan bo'lsa (offline) keraksiz qayta so'rov yuborib serverni qidirmaslik
        if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // Oflayn holatda tabga qaytganda xato otmasligi uchun
      networkMode: 'offlineFirst', // TanStack Query v5: Oflayn paytda so'rovni to'xtatmaydi, keshdan beradi
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

// Initialize background warm-cache prefetch for attendance and finance
attendanceOfflineService.init(queryClient);
financeOfflineService.init(queryClient);

// Production: Ilova yuklanganda eskirgan IndexedDB yozuvlarini tozalash
// (5 soniya kutib — sahifa renderiga xalaqit bermasligi uchun)
setTimeout(() => {
  runFullCleanup().catch(() => {});
}, 5000);

function ThemedToaster() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      toastOptions={{
        duration: 3500,
        style: {
          background: isDark ? '#0d0d0d' : '#ffffff',
          color: isDark ? '#f3f4f6' : '#120f0d',
          border: isDark ? '1px solid #27272a' : '1px solid rgba(150, 123, 79, 0.25)',
          borderRadius: '14px',
          padding: '12px 18px',
          fontSize: '13px',
          fontWeight: '600',
          boxShadow: isDark
            ? '0 10px 30px rgba(0, 0, 0, 0.6)'
            : '0 10px 30px rgba(150, 123, 79, 0.15)',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: isDark ? '#000000' : '#ffffff',
          },
          style: {
            border: isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(16, 185, 129, 0.4)',
          },
        },
        error: {
          duration: 4500,
          iconTheme: {
            primary: '#ef4444',
            secondary: '#ffffff',
          },
          style: {
            border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(239, 68, 68, 0.4)',
          },
        },
      }}
    />
  );
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ThemedToaster />
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  </ErrorBoundary>
);
