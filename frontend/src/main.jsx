import { StrictMode } from'react'
import { createRoot } from'react-dom/client'
import'./index.css'
import App from'./App.jsx'
import { QueryClient, QueryClientProvider } from'@tanstack/react-query';
import { Toaster } from'react-hot-toast';
import ErrorBoundary from'./components/Common/ErrorBoundary.jsx';

import { Provider } from'react-redux';
import { store } from'./store';

const queryClient = new QueryClient();

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
