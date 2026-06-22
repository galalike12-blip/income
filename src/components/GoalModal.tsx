import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, X, Calendar, CalendarDays, Check, TrendingUp } from 'lucide-react';
import { Goal, UserPreferences } from '../types';
import { translations } from '../i18n/translations';
import { useSettings } from '../contexts/SettingsContext';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goals: Goal[];
  onSetGoal: (goal: Omit<Goal, 'id'>) => void;
  preferences?: UserPreferences;
  updatePreferences?: (updates: Partial<UserPreferences>) => Promise<any>;
}

export function GoalModal({ isOpen, onClose, goals, onSetGoal, preferences, updatePreferences }: GoalModalProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const [activeType, setActiveType] = useState<'daily' | 'monthly'>('daily');
  const [amount, setAmount] = useState('');
  const [riderMinTargetInput, setRiderMinTargetInput] = useState('800');

  const dailyGoal = goals.find(g => g.type === 'daily');
  const monthlyGoal = goals.find(g => g.type === 'monthly');

  useEffect(() => {
    if (activeType === 'daily') {
      setAmount(dailyGoal?.targetAmount?.toString() || '');
    } else {
      setAmount(monthlyGoal?.targetAmount?.toString() || '');
    }
  }, [activeType, dailyGoal, monthlyGoal]);

  useEffect(() => {
    if (preferences?.riderMinDailyTarget !== undefined) {
      setRiderMinTargetInput(preferences.riderMinDailyTarget.toString());
    } else {
      setRiderMinTargetInput('800');
    }
  }, [preferences?.riderMinDailyTarget]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!isNaN(val) && val >= 0) {
      onSetGoal({ type: activeType, targetAmount: val });
    }
    
    // Save rider custom threshold if worker is rider and updating daily goal
    if (activeType === 'daily' && preferences?.workType === 'rider' && updatePreferences) {
      const minVal = parseFloat(riderMinTargetInput);
      if (!isNaN(minVal) && minVal >= 0) {
        updatePreferences({ riderMinDailyTarget: minVal });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="glass-panel w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 dark:border-slate-700/50"
        >
          {/* Header */}
          <div className="relative p-6 pb-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-indigo-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-wider">
                {t.goals || 'เป้าหมาย'}
              </h3>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          <div className="p-6 pt-4 space-y-6">
            {/* Type Selector */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                onClick={() => setActiveType('daily')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeType === 'daily'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                {t.daily || 'รายวัน'}
              </button>
              <button
                onClick={() => setActiveType('monthly')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeType === 'monthly'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Calendar className="w-4 h-4" />
                {t.monthly || 'รายเดือน'}
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">
                  {activeType === 'daily' ? (t.dailyGoalNeeded || 'เป้าหมายรายรับต่อวัน') : (t.monthlyGoalStatus || 'เป้าหมายรายรับต่อเดือน')}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">฿</div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border-none rounded-3xl py-6 pl-12 pr-6 text-3xl font-black text-indigo-600 dark:text-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                    autoFocus
                  />
                </div>
                {activeType === 'monthly' && amount && parseFloat(amount) > 0 && (
                  <p className="text-[10px] text-slate-400 px-3 font-medium">
                    {t.avgPerDay30} ฿{(parseFloat(amount) / 30).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                )}
                {activeType === 'daily' && monthlyGoal && (
                  <p className="text-[10px] text-amber-500 px-3 font-bold">
                    {t.monthlyGoalActiveNote}
                  </p>
                )}
              </div>

              {/* Custom Rider holiday threshold input */}
              {activeType === 'daily' && preferences?.workType === 'rider' && (
                <div className="p-4 bg-amber-500/5 dark:bg-amber-400/5 rounded-3xl border border-amber-200/30 dark:border-amber-800/20 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 block pl-1">
                    ☕ กำหนดเป้าหมายขั้นต่ำเพื่อไม่ให้ถูกนับเป็นวันหยุด
                  </label>
                  <p className="text-[10px] text-slate-400 pb-1 pl-1">
                     หากยอดรายรับวันใดไม่ถึงค่านี้ จะถูกสรุปเป็น "วันหยุด/วันไม่ได้วิ่งงาน" ในหน้าสรุปรายได้
                  </p>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">฿</div>
                    <input
                      type="number"
                      value={riderMinTargetInput}
                      onChange={(e) => setRiderMinTargetInput(e.target.value)}
                      placeholder="800"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-8 pr-4 text-sm font-bold text-amber-600 focus:ring-2 focus:ring-amber-500/25 outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.8rem] font-black text-lg shadow-xl shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Check className="w-6 h-6" />
                <span>{t.saveGoal}</span>
              </button>
            </form>

            {/* Current Stats Overview */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
               <div className="flex justify-between items-center px-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.statsSummary}</span>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/20">
                     <p className="text-[9px] font-black text-emerald-600/60 uppercase mb-1">{t.previousDailyGoal}</p>
                     <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">฿{dailyGoal?.targetAmount?.toLocaleString() || '0'}</p>
                  </div>
                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-800/20">
                     <p className="text-[9px] font-black text-indigo-600/60 uppercase mb-1">{t.previousMonthlyGoal}</p>
                     <p className="text-lg font-black text-indigo-700 dark:text-indigo-400">฿{monthlyGoal?.targetAmount?.toLocaleString() || '0'}</p>
                  </div>
               </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
