import React, { useState, useEffect } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';
import { motion, AnimatePresence } from 'motion/react';

export function IosInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  useEffect(() => {
    // Check if device is iOS
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };

    // Check if in standalone mode (already installed)
    const isStandalone = () => {
      return ('standalone' in window.navigator && (window.navigator as any).standalone) || window.matchMedia('(display-mode: standalone)').matches;
    };

    // Show prompt if iOS, not standalone, and we haven't dismissed it lately
    if (isIos() && !isStandalone()) {
      const dismissed = localStorage.getItem('ios_install_dismissed');
      const now = new Date().getTime();
      
      // If we haven't dismissed it, or it was dismissed more than 7 days ago
      if (!dismissed || (now - parseInt(dismissed)) > 7 * 24 * 60 * 60 * 1000) {
        // Delay showing prompt slightly
        setTimeout(() => setShowPrompt(true), 3000);
      }
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('ios_install_dismissed', new Date().getTime().toString());
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed left-4 right-4 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-indigo-100 dark:border-indigo-900/30 p-4"
        style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
      >
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex gap-4 pr-6">
          <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
            <img src="/icon.svg" alt="App Icon" className="w-8 h-8 drop-shadow-md" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">
              ติดตั้งแอปเพื่อใช้งานแบบเต็มจอ
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              ติดตั้งเข้าหน้า Home ของคุณ โดยกดที่ปุ่ม <Share className="w-3 h-3 inline mx-1" /> ด้านล่าง แล้วเลือก <strong>"Add to Home Screen"</strong> <PlusSquare className="w-3 h-3 inline mx-1" />
            </p>
          </div>
        </div>
        
        <div className="relative h-2 flex justify-center mt-2">
          <div className="absolute -bottom-6 w-0 h-0 border-l-[10px] border-l-transparent border-t-[10px] border-t-white dark:border-t-slate-800 border-r-[10px] border-r-transparent animate-bounce"></div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
