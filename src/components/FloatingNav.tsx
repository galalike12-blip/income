import React from 'react';
import { Plus, ArrowUp, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface FloatingNavProps {
  onAddExpense: () => void;
  onAddIncome: () => void;
  onOpenAI: () => void;
}

export function FloatingNav({ onAddExpense, onAddIncome, onOpenAI }: FloatingNavProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-xs sm:max-w-sm">
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
          onClick={onOpenAI}
          className="flex flex-col items-center justify-center w-[65px] h-12 rounded-full text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
          title="AI Chatbot"
        >
          <Sparkles className="w-6 h-6" />
        </motion.button>

      </div>
    </div>
  );
}
