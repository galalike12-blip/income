import React, { useState, useMemo, useEffect } from 'react';
import { JobEntry, DailySummary, ExpenseEntry, Goal, UserPreferences } from '../types';
import { Plus, Trash2, Calendar, DollarSign, TrendingUp, TrendingDown, Pencil, X, Settings2, Check, GripVertical, ChevronDown, ChevronUp, Gift, Target, BarChart2, ArrowUpCircle, Wallet, Circle, CheckCircle2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { toast } from 'sonner';

interface DashboardProps {
  jobs: JobEntry[];
  expenses?: ExpenseEntry[];
  editJob: (job: JobEntry) => void;
  deleteJob: (id: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  incentives: Record<string, number>;
  setIncentive: (date: string, amount: number) => void;
  goals: Goal[];
  setGoal: (goal: Omit<Goal, 'id'>) => void;
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  transferIncomeToExpenses: () => void;
  untransferredIncentivesAmount: number;
  showSettings?: boolean;
}

export function Dashboard({ jobs, expenses = [], editJob, deleteJob, selectedDate, setSelectedDate, incentives, setIncentive, goals, setGoal, preferences, updatePreferences, transferIncomeToExpenses, untransferredIncentivesAmount, showSettings = false }: DashboardProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const validWidgets = ['goals', 'netIncome', 'transfer', 'dailyAverage', 'incomeComparison', 'dailyIncentive', 'form', 'list'];
  const savedOrder = preferences?.dashboardWidgetOrder || [];
  
  let processedSavedOrder: string[] = [];
  savedOrder.forEach(id => {
    if (id === 'summary') {
      processedSavedOrder.push('netIncome', 'transfer', 'dailyAverage', 'incomeComparison', 'dailyIncentive');
    } else {
      processedSavedOrder.push(id);
    }
  });

  const widgetOrder = processedSavedOrder.length > 0 
    ? [...processedSavedOrder.filter(id => validWidgets.includes(id)), ...validWidgets.filter(id => !processedSavedOrder.includes(id))] 
    : ['goals', 'netIncome', 'transfer', 'dailyAverage', 'incomeComparison', 'dailyIncentive', 'list'];
  const setWidgetOrder = (newOrder: string[]) => updatePreferences({ dashboardWidgetOrder: newOrder });

  const [mainWidgetVisibility, setMainWidgetVisibility] = useLocalStorage('dashboard-main-widget-visibility', {
    goals: true, netIncome: true, dailyIncentive: true, dailyAverage: true, incomeComparison: true, list: true, transfer: true, form: true
  });
  
  // Provide defaults for migrated keys if they are missing
  const visibilitySafe = { ...mainWidgetVisibility };
  ['goals', 'netIncome', 'dailyIncentive', 'dailyAverage', 'incomeComparison', 'list', 'transfer', 'form'].forEach(key => {
    if (visibilitySafe[key as keyof typeof visibilitySafe] === undefined) {
      if (['netIncome', 'dailyIncentive', 'dailyAverage', 'incomeComparison'].includes(key)) {
         (visibilitySafe as any)[key] = (mainWidgetVisibility as any)['summary'] ?? true;
      } else {
         (visibilitySafe as any)[key] = true;
      }
    }
  });

  const totalUntransferred = useMemo(() => {
    const jobNet = jobs.filter(j => !j.transferred).reduce((sum, j) => {
      const amountToCollect = j.customerMustPay + j.upfrontCost;
      const diff = (j.actualReceived ?? amountToCollect) - amountToCollect;
      return sum + j.appNetIncome + diff;
    }, 0);
    return jobNet + untransferredIncentivesAmount;
  }, [jobs, untransferredIncentivesAmount]);

  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [dailyGoalAmount, setDailyGoalAmount] = useState('');
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  const [isEditingIncentive, setIsEditingIncentive] = useState(false);
  const [incentiveInput, setIncentiveInput] = useState('');
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const isLeaveDay = preferences?.leaveDays?.includes(selectedDate) || false;

  useEffect(() => {
    setIsEditingIncentive(false);
  }, [selectedDate]);

  const handleIncentiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newIncentive = parseFloat(incentiveInput) || 0;
    try {
      await setIncentive(selectedDate, newIncentive);
      toast.success('บันทึกอินเซนทีฟสำเร็จ');
      setIsEditingIncentive(false);
    } catch (err) {
      console.error(err);
      toast.error('ไม่สามารถบันทึกอินเซนทีฟได้');
    }
  };

  const handleBalanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newBalance = parseFloat(balanceInput);
    if (!isNaN(newBalance)) {
      updatePreferences({ expenseBalance: newBalance });
      toast.success('บันทึกยอดเงินคงเหลือในบัญชีรายจ่ายเรียบร้อย');
    }
    setIsEditingBalance(false);
  };

  const todaysJobs = useMemo(() => jobs.filter(j => j.date.startsWith(selectedDate)), [jobs, selectedDate]);
  const groupedHistory = useMemo(() => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const filtered = jobs.filter(j => new Date(j.date) >= threeMonthsAgo);
    const groups: Record<string, JobEntry[]> = {};
    
    filtered.forEach(job => {
      const dateKey = job.date.split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(job);
    });
    
    return Object.entries(groups)
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([date, items]) => ({ date, items }));
  }, [jobs]);
  const dailyGoal = useMemo(() => goals.find(g => g.type === 'daily'), [goals]);

  const summary: DailySummary = useMemo(() => {
    const totalCustomerMustPay = todaysJobs.reduce((sum, j) => sum + j.customerMustPay, 0);
    const totalUpfront = todaysJobs.reduce((sum, j) => sum + j.upfrontCost, 0);
    const totalAppNetIncome = todaysJobs.reduce((sum, j) => sum + j.appNetIncome, 0);
    const totalReceived = todaysJobs.reduce((sum, j) => sum + j.actualReceived, 0);
    
    let totalTip = 0;
    let totalLoss = 0;
    todaysJobs.forEach(j => {
      const diff = j.actualReceived - (j.customerMustPay + j.upfrontCost);
      if (diff > 0) totalTip += diff;
      if (diff < 0) totalLoss += Math.abs(diff);
    });
    
    const dailyIncentive = incentives[selectedDate] || 0;
    
    const grossIncome = totalAppNetIncome + totalTip - totalLoss + dailyIncentive;
    const netIncome = grossIncome;
    const tipPercentage = totalCustomerMustPay > 0 ? (totalTip / totalCustomerMustPay) * 100 : 0;

    return { totalCustomerMustPay, totalUpfront, totalAppNetIncome, totalReceived, totalTip, totalLoss, grossIncome, netIncome, tipPercentage };
  }, [todaysJobs, incentives, selectedDate]);

  const yesterdayStr = useMemo(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, [selectedDate]);

  const yesterdaysJobs = useMemo(() => jobs.filter(j => j.date.startsWith(yesterdayStr)), [jobs, yesterdayStr]);

  const yesterdayGrossIncome = useMemo(() => {
    const totalAppNetIncome = yesterdaysJobs.reduce((sum, j) => sum + j.appNetIncome, 0);
    let totalTip = 0;
    let totalLoss = 0;
    yesterdaysJobs.forEach(j => {
      const diff = j.actualReceived - (j.customerMustPay + j.upfrontCost);
      if (diff > 0) totalTip += diff;
      if (diff < 0) totalLoss += Math.abs(diff);
    });
    const yesterdayIncentive = incentives[yesterdayStr] || 0;
    return totalAppNetIncome + totalTip - totalLoss + yesterdayIncentive;
  }, [yesterdaysJobs, incentives, yesterdayStr]);

  const monthlyGrossIncome = useMemo(() => {
    const [year, month, day] = selectedDate.split('-');
    const monthPrefix = `${year}-${month}`;
    // Filter jobs from start of month up to selectedDate
    const monthJobs = jobs.filter(j => j.date.startsWith(monthPrefix) && j.date.split('T')[0] <= selectedDate);
    
    const totalAppNetIncome = monthJobs.reduce((sum, j) => sum + j.appNetIncome, 0);
    let totalTip = 0;
    let totalLoss = 0;
    monthJobs.forEach(j => {
      const diff = j.actualReceived - (j.customerMustPay + j.upfrontCost);
      if (diff > 0) totalTip += diff;
      if (diff < 0) totalLoss += Math.abs(diff);
    });
    
    // Sum incentives for the month up to selectedDate
    const monthIncentives = Object.entries(incentives)
      .filter(([date]) => date.startsWith(monthPrefix) && date <= selectedDate)
      .reduce((sum, [, amount]) => sum + amount, 0);
      
    return totalAppNetIncome + totalTip - totalLoss + monthIncentives;
  }, [jobs, incentives, selectedDate]);

  const monthlyGoal = useMemo(() => goals.find(g => g.type === 'monthly'), [goals]);

  const dailyAverage = useMemo(() => {
    const [selYear, selMonth] = selectedDate.split('-').map(Number);
    const monthPrefix = `${selYear}-${String(selMonth).padStart(2, '0')}`;
    
    // Get unique days with jobs in this month up to selectedDate
    const workDays = new Set(
      jobs
        .filter(j => j.date.startsWith(monthPrefix) && j.date.split('T')[0] <= selectedDate)
        .map(j => j.date.split('T')[0])
    );

    return workDays.size > 0 ? monthlyGrossIncome / workDays.size : 0;
  }, [monthlyGrossIncome, selectedDate, jobs]);

  const remainingGoalMessage = useMemo(() => {
    if (!monthlyGoal) return null;
    
    const [selYear, selMonth] = selectedDate.split('-').map(Number);
    const lastDayOfMonth = new Date(selYear, selMonth, 0).getDate();
    
    // Days including today
    const currentDate = new Date(selectedDate);
    const dayOfMonth = currentDate.getDate();
    
    let daysLeft = 0;
    const currentLeaveDays = preferences?.leaveDays || [];
    for (let d = dayOfMonth; d <= lastDayOfMonth; d++) {
      const iterStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!currentLeaveDays.includes(iterStr)) {
        daysLeft++;
      }
    }
    
    // Income BEFORE today
    const incomeBeforeToday = monthlyGrossIncome - summary.grossIncome;
    const amountNeeded = monthlyGoal.targetAmount - incomeBeforeToday;
    
    const isTodayLeave = currentLeaveDays.includes(selectedDate);
    const dailyRequired = isTodayLeave ? 0 : (daysLeft > 0 ? amountNeeded / daysLeft : 0);
    
    if (daysLeft < 0) return null;
    
    return {
      dailyRequired: Math.max(0, dailyRequired),
      daysRemaining: daysLeft,
      totalRemaining: Math.max(0, monthlyGoal.targetAmount - monthlyGrossIncome)
    };
  }, [monthlyGoal, monthlyGrossIncome, summary.grossIncome, selectedDate, preferences?.leaveDays]);

  // The actual daily target to show in the progress bar
  const effectiveDailyTarget = useMemo(() => {
    if (remainingGoalMessage) return remainingGoalMessage.dailyRequired;
    return dailyGoal?.targetAmount || 0;
  }, [remainingGoalMessage, dailyGoal]);

  const diffFromYesterday = summary.grossIncome - yesterdayGrossIncome;
  const isPositiveDiff = diffFromYesterday >= 0;
  const diffDisplay = `${isPositiveDiff ? t.moreThan : t.lessThan} ฿${Math.abs(diffFromYesterday).toFixed(2)}`;

  // Variable aliases for the new summary widgets layout
  const comparisonAmount = summary.netIncome - yesterdayGrossIncome;
  const totalNet = summary.netIncome;
  const totalIncentives = incentives[selectedDate] || 0;
  const overallAverage = dailyAverage;


  const last7DaysData = useMemo(() => {
    const data = [];
    const [selYear, selMonth, selDay] = selectedDate.split('-').map(Number);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(selYear, selMonth - 1, selDay);
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      if (d > today) {
        continue;
      }

      const dayJobs = jobs.filter(j => j.date.startsWith(dateStr));
      
      const totalAppNetIncome = dayJobs.reduce((sum, j) => sum + j.appNetIncome, 0);
      let totalTip = 0;
      let totalLoss = 0;
      dayJobs.forEach(j => {
        const diff = j.actualReceived - (j.customerMustPay + j.upfrontCost);
        if (diff > 0) totalTip += diff;
        if (diff < 0) totalLoss += Math.abs(diff);
      });
      const dailyIncentive = incentives[dateStr] || 0;
      const grossIncome = totalAppNetIncome + totalTip - totalLoss + dailyIncentive;
      
      data.push({
        date: d.toLocaleDateString(currentLang === 'th' ? 'th-TH' : currentLang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short', day: 'numeric' }),
        income: grossIncome
      });
    }
    return data;
  }, [jobs, incentives, selectedDate, currentLang]);

  const handleEditClick = (job: JobEntry) => {
    editJob(job);
  };

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(dailyGoalAmount);
    if (amount > 0) {
      setGoal({ type: 'daily', targetAmount: amount });
    }
    setIsEditingGoal(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pt-2 pb-0 space-y-6">
      {/* Header & Date Picker */}
      <div className="flex flex-col gap-3 glass-panel p-4 rounded-3xl transition-colors">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{t.dailyEarnings}</h1>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button 
            onClick={() => {
              const today = new Date();
              setSelectedDate(new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]);
            }}
            className="px-4 h-[38px] flex items-center justify-center text-sm font-medium text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100/80 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-2xl transition-colors backdrop-blur-sm"
          >
            {t.today}
          </button>
          
          <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/50 dark:border-slate-700/50 p-1 px-3 rounded-2xl flex items-center justify-between min-h-[38px] shrink-0">
            <button onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
            <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate px-2 min-w-[100px] text-center">
              {new Date(selectedDate).toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button disabled={selectedDate === new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]} onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded-xl transition-colors cursor-pointer"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            className="overflow-hidden space-y-6 mb-6"
          >
            <div className="glass-panel p-4 rounded-[2rem] space-y-3 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10">
              <h4 className="text-sm font-black text-slate-800 dark:text-white px-2">ตั้งค่าวิดเจ็ตและไพ่สรุปยอด</h4>
              <Reorder.Group axis="y" values={widgetOrder} onReorder={setWidgetOrder} className="space-y-2">
                {widgetOrder.map(id => (
                  <Reorder.Item key={id} value={id} className={`p-3 rounded-2xl flex items-center gap-3 transition-colors ${visibilitySafe[id as keyof typeof visibilitySafe] ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white' : 'bg-white/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500'}`}>
                    <div 
                      onClick={() => setMainWidgetVisibility({...visibilitySafe, [id]: !visibilitySafe[id as keyof typeof visibilitySafe]})}
                      className="flex-1 flex items-center gap-3 cursor-pointer"
                    >
                      {visibilitySafe[id as keyof typeof visibilitySafe] ? <CheckCircle2 className="text-emerald-500 w-5 h-5"/> : <Circle className="text-slate-300 dark:text-slate-600 w-5 h-5"/>}
                      <span className="font-medium text-sm flex items-center gap-2">
                        {id === 'goals' && "เป้าหมายรายได้ (Goals)"}
                        {id === 'netIncome' && <><DollarSign className="w-4 h-4 text-indigo-500" /> ยอดสุทธิ</>}
                        {id === 'dailyIncentive' && <><Gift className="w-4 h-4 text-indigo-500" /> โบนัสรายวัน</>}
                        {id === 'dailyAverage' && <><BarChart2 className="w-4 h-4 text-indigo-500" /> ค่าเฉลี่ยรายวัน</>}
                        {id === 'incomeComparison' && <><TrendingUp className="w-4 h-4 text-indigo-500" /> เปรียบเทียบรายได้</>}
                        {id === 'transfer' && "ตัดยอดเข้ารายจ่าย (Transfer)"}
                        {id === 'form' && t.addJobEntry}
                        {id === 'list' && t.todaysEntries}
                      </span>
                    </div>
                    <GripVertical className="cursor-grab active:cursor-grabbing text-slate-400" />
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {(() => {
          const groupedWidgets: any[] = [];
          let currentGroup: any = null;
          widgetOrder.forEach(id => {
            if (!visibilitySafe[id as keyof typeof visibilitySafe]) return;
            if (['netIncome', 'transfer', 'dailyAverage', 'incomeComparison', 'dailyIncentive'].includes(id)) {
              if (!currentGroup || currentGroup.type !== 'grid') {
                currentGroup = { type: 'grid', items: [] };
                groupedWidgets.push(currentGroup);
              }
              currentGroup.items.push(id);
            } else {
              currentGroup = null;
              groupedWidgets.push({ type: 'full', id });
            }
          });

          const renderWidget = (id: string) => {
             return (
               <div key={id}>
              {id === 'goals' && (
                <div className="glass-panel p-6 rounded-3xl transition-colors">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-slate-800 dark:text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-indigo-500" />
                      {t.goalProgress}
                    </h3>
                  </div>
                  
                  {effectiveDailyTarget > 0 ? (
                    <div>
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1 items-end">
                        <span className="text-slate-500 dark:text-slate-400">
                          {monthlyGoal ? t.dailyGoalNeeded : (t.daily || 'รายวัน')}
                        </span>
                        <div className="text-right">
                           <span className="text-slate-400">{t.done || 'ทำได้แล้ว'} </span>
                           <span className="text-indigo-600 dark:text-indigo-400 font-black">฿{summary.grossIncome.toLocaleString()}</span>
                           <span className="text-slate-400"> / ฿{effectiveDailyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-4 overflow-hidden shadow-inner border border-slate-200/50 dark:border-slate-700/50 p-0.5">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (summary.grossIncome / effectiveDailyTarget) * 100)}%` }}
                          className={`h-full rounded-full transition-all duration-1000 relative overflow-hidden ${summary.grossIncome >= effectiveDailyTarget ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_15px_rgba(79,70,229,0.3)]'}`}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </motion.div>
                      </div>
                      <div className="text-right text-[10px] mt-2 font-black uppercase tracking-widest">
                        {summary.grossIncome >= effectiveDailyTarget 
                          ? <span className="text-emerald-600 dark:text-emerald-400">{t.goalReached}</span>
                          : <span className="text-slate-400">
                              {t.shortBy} <span className="text-rose-500">฿{Math.max(0, effectiveDailyTarget - summary.grossIncome).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </span>}
                      </div>

                      {remainingGoalMessage && (
                        <div className="mt-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-[1.5rem] border border-indigo-100/50 dark:border-indigo-800/30">
                          <div className="flex items-start gap-3">
                             <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center flex-shrink-0 animate-bounce">
                                <Target className="w-4 h-4 text-indigo-500" />
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-indigo-600/60 dark:text-indigo-400/60 uppercase tracking-widest mb-1">{t.monthlyGoalStatus}</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                                   {t.remaining || 'เหลือเีก'} <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{remainingGoalMessage.totalRemaining.toLocaleString()} ฿</span> {t.remainingToGoal} <br/>
                                   (<span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{remainingGoalMessage.daysRemaining} {t.lastDaysOfMonth || 'วันสุดท้าย'}</span>)
                                </p>
                             </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isLeaveDay ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="text-sm text-amber-600 dark:text-amber-500 py-4 mb-4 text-center glass-panel-subtle !bg-amber-50 dark:!bg-amber-900/10 rounded-2xl border-dashed !border-amber-200 dark:!border-amber-800 font-bold">
                        <div className="text-lg mb-1">🏖️ วันนี้เป็นวันหยุด (ลา)</div>
                        <div className="text-amber-700/80 dark:text-amber-400/80 font-normal">
                          {preferences?.leaveReasons?.[selectedDate] ? `เหตุผล: ${preferences.leaveReasons[selectedDate]}` : 'ได้รับการยกเว้นและถูกหักออกจากเป้าหมายรายวันแล้ว'}
                        </div>
                      </div>
                      {remainingGoalMessage && (
                        <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-[1.5rem] border border-indigo-100/50 dark:border-indigo-800/30">
                          <div className="flex items-start gap-3">
                             <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center flex-shrink-0 animate-bounce">
                                <Target className="w-4 h-4 text-indigo-500" />
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-indigo-600/60 dark:text-indigo-400/60 uppercase tracking-widest mb-1">{t.monthlyGoalStatus}</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                                   {t.remaining || 'เหลือเีก'} <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{remainingGoalMessage.totalRemaining.toLocaleString()} ฿</span> {t.remainingToGoal} <br/>
                                   (<span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{remainingGoalMessage.daysRemaining} {t.lastDaysOfMonth || 'วันสุดท้าย'}</span>)
                                </p>
                             </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center glass-panel-subtle rounded-2xl border-dashed">
                      {t.setGoalsInMenu}
                    </div>
                  )}
                </div>
              )}

              
              {id === 'netIncome' && (
                        <div className="p-5 rounded-3xl glass-panel-subtle transition-colors col-span-1 flex flex-col justify-between min-h-[140px] h-full">
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="text-base font-semibold text-emerald-700 dark:text-emerald-400 opacity-90 leading-tight block truncate pr-2 max-w-[80%]">{t.netIncome}</h3>
                              <div className="p-2 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-xl"><DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
                            </div>
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">฿{totalNet.toLocaleString()}</div>
                          </div>
                        </div>
              )}

              {id === 'dailyIncentive' && (
                        <div className="p-5 rounded-3xl glass-panel-subtle transition-colors col-span-1 flex flex-col justify-between min-h-[140px] h-full">
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="text-base font-semibold text-indigo-700 dark:text-indigo-400 opacity-90 leading-tight block truncate pr-2 max-w-[80%]">{(t as any).dailyIncentive || 'อินเซนทีฟ'}</h3>
                              <div className="p-2 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-xl"><Gift className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
                            </div>
                            
                            {!isEditingIncentive ? (
                              <div className="group cursor-pointer inline-flex items-center gap-1" onClick={() => { setIncentiveInput(String(incentives[selectedDate] || 0)); setIsEditingIncentive(true); }}>
                                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">฿{totalIncentives.toLocaleString()}</span>
                                <Pencil className="w-4 h-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            ) : (
                              <form onSubmit={(e) => {
                                e.preventDefault();
                                setIncentive(selectedDate, Number(incentiveInput) || 0);
                                setIsEditingIncentive(false);
                              }} className="flex items-center gap-2">
                                <input 
                                  type="number" 
                                  value={incentiveInput} 
                                  onChange={(e) => setIncentiveInput(e.target.value)} 
                                  className="w-24 px-2 py-1 text-lg font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                  autoFocus
                                  onBlur={() => {
                                    setIncentive(selectedDate, Number(incentiveInput) || 0);
                                    setIsEditingIncentive(false);
                                  }}
                                />
                              </form>
                            )}
                          </div>
                        </div>
              )}

              {id === 'dailyAverage' && (
                        <div className="p-5 rounded-3xl glass-panel-subtle transition-colors col-span-1 flex flex-col justify-between min-h-[140px] h-full">
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="text-base font-semibold text-sky-700 dark:text-sky-400 opacity-90 leading-tight block truncate pr-2 max-w-[80%]">{(t as any).average || 'ค่าเฉลี่ย'}</h3>
                              <div className="p-2 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-xl"><BarChart2 className="w-5 h-5 text-sky-600 dark:text-sky-400" /></div>
                            </div>
                            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">฿{overallAverage.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          </div>
                        </div>
              )}

              {id === 'incomeComparison' && (
                        <div className="p-5 rounded-3xl glass-panel-subtle transition-colors col-span-1 flex flex-col justify-between min-h-[140px] h-full">
                          <div>
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="text-base font-semibold text-violet-700 dark:text-violet-400 opacity-90 leading-tight block truncate pr-2 max-w-[80%]">{(t as any).comparison || 'เปรียบเทียบ'}</h3>
                              <div className="p-2 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-xl"><TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" /></div>
                            </div>
                            <div className="flex items-center gap-2">
                              {comparisonAmount > 0 ? (
                                <>
                                  <div className="flex items-center text-emerald-500 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg text-lg">
                                    <ArrowUpRight className="w-4 h-4 mr-1" />
                                    <span>฿{Math.abs(comparisonAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                  </div>
                                </>
                              ) : comparisonAmount < 0 ? (
                                <>
                                  <div className="flex items-center text-rose-500 font-bold bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-lg text-lg">
                                    <ArrowDownRight className="w-4 h-4 mr-1" />
                                    <span>฿{Math.abs(comparisonAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                  </div>
                                </>
                              ) : (
                                <span className="text-slate-500 font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-lg">{(t as any).equal || 'เท่ากัน'}</span>
                              )}
                              <span className="text-xs text-slate-400">vs {(t as any).yesterday || 'เมื่อวาน'}</span>
                            </div>
                          </div>
                        </div>
              )}


              {id === 'transfer' && (
                <div className="p-5 rounded-3xl glass-panel-subtle transition-colors col-span-1 flex flex-col justify-between min-h-[140px] h-full group cursor-pointer" onClick={() => totalUntransferred > 0 && setShowTransferConfirm(true)}>
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 opacity-90 leading-tight block truncate pr-2 max-w-[80%]" title={(t as any).transferIncomeToExpenses || 'ตัดยอดเข้ากระเป๋า'}>
                        {(t as any).transferIncomeToExpenses || 'ตัดยอดเข้ากระเป๋า'}
                      </h3>
                      <div className="p-2 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-xl shrink-0">
                        <Wallet className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-400 bg-clip-text text-transparent mb-1 shrink-0 whitespace-nowrap overflow-hidden text-ellipsis">
                      ฿{totalUntransferred.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
                      <span>ยอดค้างโอน</span>
                      <ArrowUpCircle className="w-3 h-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              )}

              {id === 'form' && null}

              {id === 'list' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                      {showAllHistory ? t.history : t.todaysEntries}
                    </h2>
                    <button 
                      onClick={() => setShowAllHistory(!showAllHistory)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {showAllHistory ? t.today : t.history}
                    </button>
                  </div>
                  
                  {!showAllHistory ? (
                    todaysJobs.length === 0 ? (
                      <div className="glass-panel-subtle border-dashed rounded-3xl p-10 text-center text-slate-500 dark:text-slate-400 transition-colors">
                        {t.noEntries}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {todaysJobs.map((job, index) => (
                          <JobItem 
                            key={job.id} 
                            job={job} 
                            index={index} 
                            handleEditClick={handleEditClick} 
                            deleteJob={deleteJob} 
                            t={t} 
                            expandedJobId={expandedJobId}
                            setExpandedJobId={setExpandedJobId}
                          />
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="space-y-8">
                      {groupedHistory.length === 0 ? (
                        <div className="glass-panel-subtle border-dashed rounded-3xl p-10 text-center text-slate-500 dark:text-slate-400 transition-colors">
                          {t.noDataForRange}
                        </div>
                      ) : (
                        groupedHistory.map((group) => (
                          <div key={group.date} className="space-y-2">
                            <div className="flex items-center gap-2 px-2">
                              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                {new Date(group.date + 'T00:00:00').toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US', { 
                                  day: 'numeric', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })}
                              </span>
                              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {group.items.map((job, index) => (
                                <JobItem 
                                  key={job.id} 
                                  job={job} 
                                  index={index} 
                                  handleEditClick={handleEditClick} 
                                  deleteJob={deleteJob} 
                                  t={t} 
                                  expandedJobId={expandedJobId}
                                  setExpandedJobId={setExpandedJobId}
                                />
                                ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
               </div>
             );
          };

          return groupedWidgets.map((group, idx) => {
             if (group.type === 'grid') {
               return (
                  <div key={`grid-${idx}`} className="grid grid-cols-2 gap-2">
                    {group.items.map((id: string, i: number) => (
                      <div key={id} className={(group.items.length % 2 !== 0 && i === group.items.length - 1) ? 'col-span-2' : ''}>
                        {renderWidget(id)}
                      </div>
                    ))}
                  </div>
               );
             } else {
               return renderWidget(group.id);
             }
          });
        })()}
      </div>

      <AnimatePresence>
        {showTransferConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-2">
                <ArrowUpCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold">ยืนยันการตัดยอด</h3>
              </div>
              
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                คุณต้องการตัดยอดสะสมจำนวน <span className="font-bold text-slate-900 dark:text-white text-base">฿{totalUntransferred.toFixed(2)}</span> ไปยังบัญชีรายจ่ายใช่หรือไม่?
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowTransferConfirm(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-sm font-medium"
                >
                  {t.cancel || 'ยกเลิก'}
                </button>
                <button
                  onClick={() => {
                    transferIncomeToExpenses();
                    setShowTransferConfirm(false);
                  }}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-medium shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                  {t.confirm || 'ยืนยัน'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({ title, amount, valueDisplay, subtitle, icon, bg, color, className = "" }: { title: string, amount?: number, valueDisplay?: string, subtitle?: string, icon: React.ReactNode, bg: string, color: string, className?: string }) {
  return (
    <div className={`p-5 rounded-3xl glass-panel-subtle transition-colors ${className}`}>
      <div className="flex justify-between items-start mb-3">
        <h3 className={`text-[25px] font-semibold ${color} opacity-90`}>{title}</h3>
        <div className={`p-2 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-xl`}>{icon}</div>
      </div>
      <div className={`text-[23px] font-bold ${color}`}>{valueDisplay || `฿${amount?.toFixed(2)}`}</div>
      {subtitle && <div className={`text-sm mt-1 ${color} opacity-70`}>{subtitle}</div>}
    </div>
  );
}

function JobItem({ job, index, handleEditClick, deleteJob, t, expandedJobId, setExpandedJobId }: any) {
  const isExpanded = expandedJobId === job.id;
  const amountToCollect = job.customerMustPay + job.upfrontCost;
  const diff = job.actualReceived - amountToCollect;
  const tip = diff > 0 ? diff : 0;
  const loss = diff < 0 ? Math.abs(diff) : 0;
  const net = job.appNetIncome + diff;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border transition-all duration-200 overflow-hidden h-full flex flex-col bg-white/60 dark:bg-slate-800/60 border-white/40 dark:border-slate-700/50 shadow-md hover:shadow-lg"
    >
      <div 
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors flex-1"
        onClick={() => isExpanded ? setExpandedJobId(null) : setExpandedJobId(job.id)}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="bg-indigo-100/50 dark:bg-indigo-900/30 backdrop-blur-sm text-indigo-700 dark:text-indigo-300 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0">
            {index + 1}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5 flex justify-between">
              <span>{t.jobSequence} {index + 1}</span>
              {job.date.includes('T') && (
                <span>{job.date.split('T')[1]}</span>
              )}
            </div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-2">
              ฿{net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {job.transferred && (
                <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-md font-bold uppercase tracking-tighter">
                  {t.transferred || 'โอนแล้ว'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-bold uppercase tracking-tighter text-slate-400 mb-0.5">{t.liveNetIncome}</div>
            <div className="font-black text-emerald-600 dark:text-emerald-400">฿{net.toFixed(2)}</div>
          </div>
          <div className="flex items-center gap-1">
            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-slate-50/80 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 font-medium">{t.customerMustPay}</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">฿{job.customerMustPay.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 font-medium">{t.upfrontCost}</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">฿{job.upfrontCost.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 font-medium">{t.appNetIncome}</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">฿{job.appNetIncome.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 font-medium">{t.actualReceived}</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">฿{job.actualReceived.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-slate-200/50 dark:border-slate-700/50 pt-2 sm:col-span-2">
              <div className="flex gap-4">
                {tip > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">{t.tip}: ฿{tip.toLocaleString()}</span>
                  </div>
                )}
                {loss > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                    <span className="text-rose-600 dark:text-rose-400 font-bold text-xs">{t.loss}: ฿{loss.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-xs mr-2">{t.liveNetIncome}:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black">฿{net.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); handleEditClick(job); }} 
              className="flex-1 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t.edit}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }} 
              className="flex-1 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.delete}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
