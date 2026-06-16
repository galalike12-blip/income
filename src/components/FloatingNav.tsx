import React from 'react';
import { Plus, Sparkles, LayoutDashboard, Receipt, BarChart3, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FloatingNavProps {
  onAddExpense: () => void;
  onAddIncome: () => void;
  onOpenAI: () => void;
  onLongPressAI?: () => void;
  activeTab: 'dashboard' | 'expenses' | 'summary';
  setActiveTab: (tab: 'dashboard' | 'expenses' | 'summary') => void;
}

export function FloatingNav({ onAddExpense, onAddIncome, onOpenAI, onLongPressAI, activeTab, setActiveTab }: FloatingNavProps) {
  const longPressTimer = React.useRef<any>(null);
  const [isLongPressing, setIsLongPressing] = React.useState(false);
  const pressStartTime = React.useRef<number>(0);
  const lastTriggerTime = React.useRef<number>(0);

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsLongPressing(false);
    pressStartTime.current = Date.now();
    
    longPressTimer.current = setTimeout(() => {
      const now = Date.now();
      if (now - lastTriggerTime.current < 300) return;
      
      setIsLongPressing(true);
      if (onLongPressAI) {
        onLongPressAI();
        lastTriggerTime.current = now;
      }
    }, 500);
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const now = Date.now();
    const pressDuration = now - pressStartTime.current;

    if (pressDuration < 500 && now - lastTriggerTime.current > 300) {
      onOpenAI();
      lastTriggerTime.current = now;
    }
    
    setTimeout(() => {
      setIsLongPressing(false);
    }, 100);
  };

  const handleMouseLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
  };

  return (
    <>
      {/* Contextual FAB above the navigation bar */}
      <AnimatePresence mode="wait">
        {(activeTab === 'dashboard' || activeTab === 'expenses') && (
          <motion.div
            key={activeTab}
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 20 }}
            className="fixed right-6 z-40 transition-all"
            style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={activeTab === 'dashboard' ? onAddIncome : onAddExpense}
              className={`flex items-center justify-center w-14 h-14 rounded-full text-white shadow-xl backdrop-blur-md border border-white/20 transition-colors ${
                activeTab === 'dashboard' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30' : 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/30'
              }`}
            >
              <Plus className="w-7 h-7" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className="fixed left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md pb-safe-bottom"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="relative flex items-center justify-between gap-1 bg-white/10 dark:bg-slate-900/40 backdrop-blur-[24px] border border-white/40 dark:border-white/10 rounded-[2rem] p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.4)] h-[60px] transition-all">
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 flex flex-col items-center justify-center h-full rounded-full transition-all border ${
              activeTab === 'dashboard' 
                ? 'text-indigo-600 dark:text-indigo-300 bg-white/40 dark:bg-slate-800/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_8px_rgba(0,0,0,0.05)] border-white/50 dark:border-slate-700' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/20 dark:hover:bg-white/5 border-transparent'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 mb-0.5 ${activeTab === 'dashboard' ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[9px] font-medium">รายรับ</span>
          </button>

          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 flex flex-col items-center justify-center h-full rounded-full transition-all border ${
              activeTab === 'expenses' 
                ? 'text-rose-600 dark:text-rose-300 bg-white/40 dark:bg-slate-800/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_8px_rgba(0,0,0,0.05)] border-white/50 dark:border-slate-700' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/20 dark:hover:bg-white/5 border-transparent'
            }`}
          >
            <Receipt className={`w-4 h-4 mb-0.5 ${activeTab === 'expenses' ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[9px] font-medium">รายจ่าย</span>
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 flex flex-col items-center justify-center h-full rounded-full transition-all border ${
              activeTab === 'summary' 
                ? 'text-emerald-600 dark:text-emerald-300 bg-white/40 dark:bg-slate-800/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_8px_rgba(0,0,0,0.05)] border-white/50 dark:border-slate-700' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/20 dark:hover:bg-white/5 border-transparent'
            }`}
          >
            <BarChart3 className={`w-4 h-4 mb-0.5 ${activeTab === 'summary' ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[9px] font-medium">สรุป</span>
          </button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            className={`relative flex-1 flex flex-col items-center justify-center h-full rounded-full transition-all border overflow-hidden ${
              isLongPressing 
                ? 'text-fuchsia-500 bg-fuchsia-500/20 dark:bg-fuchsia-500/20 border-fuchsia-300 dark:border-fuchsia-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_2px_8px_rgba(0,0,0,0.05)]' 
                : 'text-sky-600 dark:text-sky-400 hover:bg-white/20 dark:hover:bg-white/5 border-transparent hover:border-white/30 dark:hover:border-slate-700/50 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
            }`}
          >
            {/* Ambient glowing effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/20 to-fuchsia-500/20 pointer-events-none opacity-50" />
            <Sparkles className={`w-4 h-4 mb-0.5 z-10 ${isLongPressing ? 'animate-pulse' : ''}`} />
            <span className="text-[9px] font-bold z-10">AI Chatbot</span>
          </motion.button>
        </div>
      </div>
    </>
  );
}
