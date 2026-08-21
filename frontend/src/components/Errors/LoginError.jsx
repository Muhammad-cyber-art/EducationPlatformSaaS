import { AlertCircle } from"lucide-react";

export default function LoginError({ loginErr }) {
 return (
 <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg flex items-center gap-3 text-red-400">
 <AlertCircle className="w-5 h-5 flex-shrink-0" />
 <p className="text-sm font-medium">{loginErr}</p>
 </div>
 );
}
