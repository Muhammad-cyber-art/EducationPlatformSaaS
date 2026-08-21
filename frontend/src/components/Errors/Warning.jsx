import React from"react";

export default function WarningModal({ close, sms }) {
 return (
 <div
 className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-300"
 style={{ backgroundColor:"var(--overlay-bg)" }}
 onClick={() => close(false)}
 >
 <div
 className="w-full max-w-sm flex flex-col items-center lux-card"
 onClick={(e) => e.stopPropagation()}
 >
 <div 
 className="mb-5 p-4 rounded-full"
 style={{ backgroundColor:"var(--gold-dim)" }}
 >
 <svg
 xmlns="http://www.w3.org/2000/svg"
 className="h-12 w-12 gold-text"
 style={{ color:"var(--gold)" }}
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 17c-.77 1.333.192 3 1.732 3z"
 />
 </svg>
 </div>

 <h3 className="text-2xl font-black mb-3 tracking-tight">
 Diqqat!
 </h3>

 <p className="gold-text font-bold text-center mb-8 text-lg leading-snug">
 {sms}
 </p>

 <button
 onClick={() => close(false)}
 className="lux-btn lux-btn-primary w-full flex justify-center py-4 rounded-2xl cursor-pointer"
 >
 Tushunarli
 </button>
 </div>
 </div>
 );
}
