import React from 'react';
import { Plus, ArrowUp, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface FloatingNavProps {
  onAddExpense: () => void;
  onAddIncome: () => void;
  onOpenAI: () => void;
  onLongPressAI?: () => void;
}

export function FloatingNav({ onAddExpense, onAddIncome, onOpenAI, onLongPressAI }: FloatingNavProps) {
  const longPressTimer = React.useRef<any>(null);
  const [isLongPressing, setIsLongPressing] = React.useState(false);
  const pressStartTime = React.useRef<number>(0);

  const lastTriggerTime = React.useRef<number>(0);

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default for touch to avoid ghost mouse events
    if (e.type === 'touchstart') {
      // e.preventDefault(); // Careful with preventDefault on touch
    }
    
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
      // It was a short press and not a double trigger
      onOpenAI();
      lastTriggerTime.current = now;
    }
    
    // Reset state after a short delay to allow animation to finish
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
    <div 
      className="fixed left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-xs sm:max-w-sm pb-safe-bottom"
      style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="relative flex items-center justify-between bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-full p-2 shadow-2xl shadow-indigo-500/10 h-[62px]">
        
        {/* Add Expense Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAddExpense}
          className="flex flex-col items-center justify-center w-[65px] h-12 rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
          title="เพิ่มรายจ่าย"
        >
          <ArrowUp className="w-6 h-6" />
        </motion.button>

        {/* Add Income Button (Center, Large, Floating) */}
        <div className="relative -top-6">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAddIncome}
            className="flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-500/40 hover:bg-indigo-500 transition-all mb-[-25px]"
            title="เพิ่มรายรับ"
          >
            <Plus className="w-8 h-8" />
          </motion.button>
        </div>

        {/* AI Chatbot Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          className={`flex flex-col items-center justify-center w-[65px] h-12 rounded-full transition-all ${isLongPressing ? 'text-rose-500 scale-110' : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
          title="AI Chatbot (Long press to speak)"
        >
          <Sparkles className={`w-6 h-6 ${isLongPressing ? 'animate-pulse' : ''}`} />
        </motion.button>

      </div>
    </div>
  );
}
