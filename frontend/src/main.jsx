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

createRoot(document.getElementById('root')).render(
 <ErrorBoundary>
 <Provider store={store}>
 <QueryClientProvider client={queryClient}>
 <Toaster position="top-center" reverseOrder={false} />
 <App />
 </QueryClientProvider>
 </Provider>
 </ErrorBoundary>
)
