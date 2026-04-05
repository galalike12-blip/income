import React, { useState, useMemo } from 'react';
import { JobEntry, DailySummary, ExpenseEntry, Goal, UserPreferences } from '../types';
import { Plus, Trash2, Calendar, DollarSign, TrendingUp, TrendingDown, Pencil, X, Settings2, Check, GripVertical, ChevronDown, ChevronUp, Gift, Target, BarChart2, ArrowUpCircle } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  jobs: JobEntry[];
  addJob: (job: Omit<JobEntry, 'id'>) => void;
  editJob: (id: string, job: Omit<JobEntry, 'id'>) => void;
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
}

export function Dashboard({ jobs, addJob, editJob, deleteJob, selectedDate, setSelectedDate, incentives, setIncentive, goals, setGoal, preferences, updatePreferences, transferIncomeToExpenses }: DashboardProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const widgetOrder = preferences.dashboardWidgetOrder || ['goals', 'summary', 'transfer', 'form', 'list'];
  const setWidgetOrder = (newOrder: string[]) => updatePreferences({ dashboardWidgetOrder: newOrder });
  const [isCustomizing, setIsCustomizing] = useState(false);

  const totalUntransferred = useMemo(() => {
    return jobs.filter(j => !j.transferred).reduce((sum, j) => {
      const amountToCollect = j.customerMustPay + j.upfrontCost;
      const diff = (j.actualReceived ?? amountToCollect) - amountToCollect;
      return sum + j.appNetIncome + diff;
    }, 0);
  }, [jobs]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerMustPay, setCustomerMustPay] = useState('');
  const [upfrontCost, setUpfrontCost] = useState('');
  const [appNetIncome, setAppNetIncome] = useState('');
  const [actualReceived, setActualReceived] = useState('');
  const [jobTime, setJobTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  
  const [dailyGoalAmount, setDailyGoalAmount] = useState('');
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  const [showAllHistory, setShowAllHistory] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  const currentCustomerMustPay = parseFloat(customerMustPay) || 0;
  const currentUpfront = parseFloat(upfrontCost) || 0;
  const currentAppNet = parseFloat(appNetIncome) || 0;
  
  const currentAmountToCollect = currentCustomerMustPay + currentUpfront;
  
  // If actualReceived is empty, assume they paid exactly what was required (no extra cash tip)
  const currentReceived = actualReceived === '' ? currentAmountToCollect : (parseFloat(actualReceived) || 0);
  
  const difference = currentReceived - currentAmountToCollect;
  const currentTip = difference > 0 ? difference : 0;
  const currentLoss = difference < 0 ? Math.abs(difference) : 0;
  const currentNet = currentAppNet + difference;

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

  const diffFromYesterday = summary.grossIncome - yesterdayGrossIncome;
  const isPositiveDiff = diffFromYesterday >= 0;
  const diffDisplay = `${isPositiveDiff ? t.moreThan : t.lessThan} ฿${Math.abs(diffFromYesterday).toFixed(2)}`;

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
    setEditingId(job.id);
    setCustomerMustPay(job.customerMustPay.toString());
    setAppNetIncome(job.appNetIncome.toString());
    setUpfrontCost(job.upfrontCost ? job.upfrontCost.toString() : '');
    setActualReceived(job.actualReceived ? job.actualReceived.toString() : '');
    if (job.date.includes('T')) {
      setJobTime(job.date.split('T')[1]);
    } else {
      setJobTime('00:00');
    }
    setIsFormVisible(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsFormVisible(false);
    setCustomerMustPay('');
    setAppNetIncome('');
    setUpfrontCost('');
    setActualReceived('');
    const now = new Date();
    setJobTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Only appNetIncome is strictly required for quick entry
    if (!appNetIncome) return;

    const finalCustomerMustPay = customerMustPay ? currentCustomerMustPay : currentAppNet;
    const finalJobTime = jobTime || `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

    const jobData = {
      date: `${selectedDate}T${finalJobTime}`,
      customerMustPay: finalCustomerMustPay,
      upfrontCost: currentUpfront,
      appNetIncome: currentAppNet,
      actualReceived: currentReceived || currentAppNet, // Default actual received to app net if not provided
    };

    if (editingId) {
      editJob(editingId, jobData);
      setEditingId(null);
    } else {
      addJob(jobData);
    }

    setIsFormVisible(false);
    setCustomerMustPay('');
    setUpfrontCost('');
    setAppNetIncome('');
    setActualReceived('');
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
    <div className="max-w-5xl mx-auto px-4 pt-2 pb-4 space-y-6">
      {/* Header & Date Picker */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 glass-panel p-4 rounded-3xl transition-colors overflow-hidden">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white text-center sm:text-left">{t.dailyEarnings}</h1>
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
          <button 
            onClick={() => {
              const today = new Date();
              setSelectedDate(new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]);
            }}
            className="px-4 h-[38px] flex items-center justify-center text-sm font-medium text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100/80 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-2xl transition-colors backdrop-blur-sm"
          >
            {t.today}
          </button>
          <button 
            onClick={() => setIsCustomizing(!isCustomizing)}
            className={`flex items-center gap-2 px-4 h-[38px] rounded-2xl border transition-colors backdrop-blur-sm ${isCustomizing ? 'bg-indigo-50/95 border-indigo-200 text-indigo-700 dark:bg-indigo-900/80 dark:border-indigo-700 dark:text-indigo-300' : 'bg-white/95 border-slate-200 text-slate-700 dark:bg-slate-800/95 dark:border-slate-600 dark:text-slate-200'}`}
          >
            {isCustomizing ? <Check className="w-5 h-5" /> : <Settings2 className="w-5 h-5" />}
            <span className="hidden sm:inline font-medium">{isCustomizing ? t.doneCustomizing : t.customizeLayout}</span>
          </button>
          <div className="flex items-center gap-2 glass-input px-4 h-[38px] rounded-2xl w-[145px]">
            <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400 flex-shrink-0 -ml-[4px]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-200 font-medium text-[14px] color-scheme-light dark:color-scheme-dark w-full"
              style={{ colorScheme: 'light dark' }}
            />
          </div>
        </div>
      </div>

      {isCustomizing ? (
        <Reorder.Group axis="y" values={widgetOrder} onReorder={setWidgetOrder} className="space-y-4">
          {widgetOrder.map(id => (
            <Reorder.Item key={id} value={id} className="glass-panel p-4 rounded-3xl flex items-center gap-4 cursor-grab active:cursor-grabbing">
              <GripVertical className="text-slate-400" />
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {id === 'goals' && "เป้าหมายรายได้ (Goals)"}
                {id === 'summary' && t.dailyEarnings}
                {id === 'transfer' && "ตัดยอดเข้ารายจ่าย (Transfer)"}
                {id === 'form' && t.addJobEntry}
                {id === 'list' && t.todaysEntries}
                {id === 'expenses' && "รายจ่าย (Expenses)"}
              </span>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <div className="space-y-6">
          {widgetOrder.map(id => (
            <div key={id}>
              {id === 'goals' && (
                <div className="glass-panel p-6 rounded-3xl transition-colors">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium text-slate-800 dark:text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-indigo-500" />
                      เป้าหมายรายได้วันนี้
                    </h3>
                    {!isEditingGoal && (
                      <button onClick={() => { setDailyGoalAmount(dailyGoal?.targetAmount?.toString() || ''); setIsEditingGoal(true); }} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                        {dailyGoal ? 'แก้ไขเป้าหมาย' : 'ตั้งเป้าหมาย'}
                      </button>
                    )}
                  </div>
                  
                  {isEditingGoal ? (
                    <form onSubmit={handleGoalSubmit} className="flex gap-2">
                      <input 
                        type="number" 
                        value={dailyGoalAmount} 
                        onChange={e => setDailyGoalAmount(e.target.value)} 
                        placeholder="ระบุเป้าหมาย (บาท)" 
                        className="flex-1 px-4 py-2 rounded-2xl glass-input"
                        required
                      />
                      <button type="submit" className="px-6 py-2 glass-button rounded-2xl font-medium">บันทึก</button>
                      <button type="button" onClick={() => setIsEditingGoal(false)} className="px-6 py-2 glass-button-secondary rounded-2xl font-medium">ยกเลิก</button>
                    </form>
                  ) : dailyGoal ? (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500 dark:text-slate-400">ทำได้แล้ว ฿{summary.grossIncome.toFixed(2)}</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">เป้าหมาย ฿{dailyGoal.targetAmount.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-3 rounded-full transition-all duration-500 ${summary.grossIncome >= dailyGoal.targetAmount ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                          style={{ width: `${Math.min(100, (summary.grossIncome / dailyGoal.targetAmount) * 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-right text-xs mt-1 text-slate-500 dark:text-slate-400">
                        {summary.grossIncome >= dailyGoal.targetAmount 
                          ? "🎉 ยินดีด้วย! คุณทำได้ตามเป้าแล้ว" 
                          : `ขาดอีก ฿${(dailyGoal.targetAmount - summary.grossIncome).toFixed(2)}`}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 dark:text-slate-400">ยังไม่ได้ตั้งเป้าหมายรายได้สำหรับวันนี้</div>
                  )}
                </div>
              )}

              {id === 'summary' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    <SummaryCard title={t.netIncome} amount={summary.netIncome} icon={<DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />} bg="bg-emerald-50 dark:bg-emerald-900/30" color="text-emerald-700 dark:text-emerald-400" className="col-span-1" />
                    
                    <div className="p-5 rounded-3xl glass-panel-subtle transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[25px] font-semibold text-violet-700 dark:text-violet-400 opacity-90">{t.dailyIncentive}</h3>
                        <div className="p-2 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-xl"><Gift className="w-5 h-5 text-violet-600 dark:text-violet-400" /></div>
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-[23px] font-bold text-violet-700 dark:text-violet-400">฿</span>
                        <input
                          type="number"
                          value={incentives[selectedDate] || ''}
                          onChange={(e) => setIncentive(selectedDate, parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full bg-transparent text-[23px] font-bold text-violet-700 dark:text-violet-400 outline-none placeholder-violet-300 dark:placeholder-violet-700/50"
                        />
                      </div>
                    </div>

                    <SummaryCard 
                      title={t.vsYesterday} 
                      valueDisplay={diffDisplay}
                      icon={isPositiveDiff ? <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />} 
                      bg={isPositiveDiff ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-rose-50 dark:bg-rose-900/30"} 
                      color={isPositiveDiff ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"} 
                    />
                  </div>
                  
                  <div className="glass-panel p-6 rounded-3xl transition-colors">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                      <BarChart2 className="w-5 h-5 text-indigo-500" />
                      {t.incomeComparison || 'เปรียบเทียบรายได้ 7 วันล่าสุด'}
                    </h3>
                    <div className="h-[250px] w-full min-w-0 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={last7DaysData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `฿${value}`} />
                          <Tooltip 
                            cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => [`฿${value.toFixed(2)}`, t.netIncome]}
                          />
                          <Bar dataKey="income" fill="#4f46e5" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {id === 'transfer' && (
                <div className="glass-panel p-6 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                      <h3 className="text-lg font-semibold opacity-90 mb-1">ยอดสะสมรอตัดเข้ารายจ่าย</h3>
                      <div className="text-3xl font-bold">฿{totalUntransferred.toFixed(2)}</div>
                    </div>
                    <button
                      onClick={() => {
                        if (totalUntransferred > 0) {
                          setShowTransferConfirm(true);
                        }
                      }}
                      disabled={totalUntransferred <= 0}
                      className={`px-8 py-3 rounded-2xl font-bold text-lg transition-all ${totalUntransferred > 0 ? 'bg-white text-indigo-600 hover:bg-indigo-50 shadow-md active:scale-95' : 'bg-white/30 text-white/50 cursor-not-allowed'}`}
                    >
                      ตัดยอดเข้ารายจ่าย
                    </button>
                  </div>
                </div>
              )}

              {id === 'form' && (
                <div className="space-y-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      const now = new Date();
                      setJobTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                      setIsFormVisible(true);
                    }}
                    className="w-full py-8 glass-panel rounded-3xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 flex flex-col items-center justify-center gap-3 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="w-8 h-8" />
                    </div>
                    <span className="font-bold text-xl">{t.addJobEntry}</span>
                  </motion.button>
                </div>
              )}

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
                            editingId={editingId} 
                            handleEditClick={handleEditClick} 
                            deleteJob={deleteJob} 
                            t={t} 
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
                                  editingId={editingId} 
                                  handleEditClick={handleEditClick} 
                                  deleteJob={deleteJob} 
                                  t={t} 
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
          ))}
        </div>
      )}

      <AnimatePresence>
        {isFormVisible && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cancelEdit}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 dark:border-slate-800"
            >
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                    {editingId ? t.updateEntry : t.addJobEntry}
                  </h2>
                  <button
                    onClick={cancelEdit}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 relative">
                      <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1.5 ml-1 uppercase tracking-wider">
                        {t.appNetIncome} *
                      </label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={appNetIncome} 
                        onChange={e => setAppNetIncome(e.target.value)} 
                        placeholder="0.00" 
                        className="w-full h-[46px] px-4 bg-indigo-50/50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-900/50 rounded-xl text-lg font-bold text-indigo-700 dark:text-indigo-300 focus:border-indigo-500 outline-none transition-all placeholder:text-indigo-200" 
                        required 
                        autoFocus
                      />
                      <div className="absolute top-3 right-4 -mt-[11px] text-[10px] text-indigo-400 italic font-medium">
                        {currentLang === 'th' ? 'ใส่แค่ยอดนี้ก็ได้' : 'Quick entry'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">{t.customerMustPay}</label>
                      <input type="number" step="0.01" value={customerMustPay} onChange={e => setCustomerMustPay(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm" />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">{t.actualReceived}</label>
                      <input type="number" step="0.01" value={actualReceived} onChange={e => setActualReceived(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm" />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">{t.upfrontCost}</label>
                      <input type="number" step="0.01" value={upfrontCost} onChange={e => setUpfrontCost(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm" />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1 ml-1">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">{t.time || 'เวลา'}</label>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            setJobTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                          }}
                          className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {t.now || 'ตอนนี้'}
                        </button>
                      </div>
                      <input type="time" value={jobTime} onChange={e => setJobTime(e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 outline-none transition-all text-sm" />
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t.amountToCollectCalculated}</div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">฿{currentAmountToCollect.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{currentLoss > 0 ? 'ขาดทุน' : t.tipCalculated}</div>
                      <div className={`text-sm font-bold ${currentLoss > 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                        ฿{(currentLoss > 0 ? currentLoss : currentTip).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t.liveNetIncome}</div>
                      <div className="text-sm font-bold text-emerald-600">฿{currentNet.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      type="submit" 
                      className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 text-sm"
                    >
                      <Check className="w-5 h-5" />
                      {editingId ? t.updateEntry : t.addEntry}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

function JobItem({ job, index, editingId, handleEditClick, deleteJob, t }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const amountToCollect = job.customerMustPay + job.upfrontCost;
  const diff = job.actualReceived - amountToCollect;
  const tip = diff > 0 ? diff : 0;
  const loss = diff < 0 ? Math.abs(diff) : 0;
  const net = job.appNetIncome + diff;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden h-full flex flex-col ${
        editingId === job.id 
          ? 'bg-indigo-50/40 dark:bg-indigo-900/10 border-indigo-200/50 dark:border-indigo-800/30 ring-2 ring-indigo-400/50' 
          : 'bg-white/60 dark:bg-slate-800/60 border-white/40 dark:border-slate-700/50 shadow-md hover:shadow-lg'
      }`}
    >
      <div 
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors flex-1"
        onClick={() => setIsExpanded(!isExpanded)}
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
