import React from 'react';

export default function PageLoader() {
  return (
    <div className="w-full h-screen min-h-[400px] flex flex-col items-center justify-center bg-transparent">
      <div className="relative flex items-center justify-center">
        <div className="w-14 h-14 rounded-full border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 animate-spin" />
        <div className="absolute w-8 h-8 rounded-full bg-indigo-500/20 animate-ping" />
      </div>
      <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse tracking-wide">
        Yuklanmoqda...
      </p>
    </div>
  );
}
