import { Component } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends Component {
 constructor(props) {
 super(props);
 this.state = { hasError: false, error: null, errorInfo: null };
 }

 static getDerivedStateFromError(error) {
 return { hasError: true };
 }

 componentDidCatch(error, errorInfo) {
 this.setState({ error, errorInfo });
 // Log to error reporting service
 console.error('ErrorBoundary caught an error:', error, errorInfo);
 }

 handleRetry = () => {
 this.setState({ hasError: false, error: null, errorInfo: null });
 window.location.reload();
 };

 render() {
 if (this.state.hasError) {
 return (
 <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
 <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
 <div className="flex justify-center mb-4">
 <AlertCircle className="w-16 h-16 text-red-500" />
 </div>
 <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
 Kutilmagan xatolik yuz berdi
 </h2>
 <p className="text-gray-600 dark:text-gray-400 mb-6">
 Iltimos, sahifani yangilab ko'ring yoki keyinroq urunib ko'ring.
 </p>
 <button
 onClick={this.handleRetry}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
 >
 <RefreshCcw className="w-4 h-4" />
 Sahifani yangilash
 </button>
 </div>
 </div>
 );
 }

 return this.props.children;
 }
}

export default ErrorBoundary;
