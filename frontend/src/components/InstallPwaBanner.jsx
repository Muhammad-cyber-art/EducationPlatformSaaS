import React, { useState, useEffect } from 'react';
import { Download, X, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { requestPersistentStorage } from '../db/db';

const BANNER_DISMISSED_KEY = 'pwa_banner_dismissed_until';

export default function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 1. Storage persistence (Android Chrome / Desktop)
    requestPersistentStorage();

    // 2. Tarmoq o'zgarishlarini kuzatish
    const handleOnline = () => {
      toast.success("Internet aloqasi tiklandi. Ma'lumotlar sinxronlanmoqda...", {
        id: 'network-status-toast',
        icon: <Wifi size={16} className="text-emerald-400" />,
        duration: 3500,
      });
    };

    const handleOffline = () => {
      toast("Internet uzildi. Tizim oflayn rejimga o'tdi.", {
        id: 'network-status-toast',
        icon: <WifiOff size={16} className="text-amber-400" />,
        duration: 4000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. PWA o'rnatish taklifini eshitish (Android / Chrome / Edge)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Agar ilova allaqachon standalone rejimida ochilmagan bo'lsa
      const isStandalone =
        typeof window !== 'undefined' &&
        window.matchMedia('(display-mode: standalone)').matches;

      // Agar foydalanuvchi "Keyinroq" bosgan bo'lsa va vaqti tugamagan bo'lsa
      const dismissedUntil = localStorage.getItem(BANNER_DISMISSED_KEY);
      const isDismissed = dismissedUntil && Date.now() < Number(dismissedUntil);

      if (!isStandalone && !isDismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // 3 kun davomida qayta bezovta qilmaslik
    const threeDaysLater = Date.now() + 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem(BANNER_DISMISSED_KEY, String(threeDaysLater));
  };

  if (!showBanner) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 p-4 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom duration-300"
      style={{
        background: 'var(--bg-panel, #171717)',
        border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
          <Download size={20} />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-white">Ilovani o'rnatish</h4>
          <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
            Internet yo'q bo'lganda ham uzluksiz ishlash uchun CRM-ni Android planshet yoki kompyuteringizga o'rnating.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md flex items-center gap-1.5"
            >
              <Download size={13} />
              O'rnatish
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold transition-all"
            >
              Keyinroq
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-neutral-500 hover:text-neutral-300 transition-colors p-1"
          aria-label="Yopish"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
