import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Wallet,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Filter,
  CheckCircle2,
  XCircle,
  Coins,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';
import { JobEntry, ExpenseEntry } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';

interface SummaryProps {
  jobs: JobEntry[];
  expenses: ExpenseEntry[];
  incentives: Record<string, number>;
}

type SubTab = 'daily' | 'weekly' | 'monthly' | 'custom';

export function Summary({ jobs, expenses, incentives }: SummaryProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const [activeTab, setActiveTab] = useState<SubTab>('monthly');
  
  // Helper to get local date string YYYY-MM-DD
  const getLocalDateStr = (d: Date) => {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  };

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return getLocalDateStr(d);
  });
  const [endDate, setEndDate] = useState(() => getLocalDateStr(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => getLocalDateStr(new Date()));
  // Need a state to track weekly offset from 'now'
  const [weekOffset, setWeekOffset] = useState(0); 
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const navigateDate = (direction: number) => {
    const now = new Date();
    if (activeTab === 'daily') {
      const d = new Date(selectedDay);
      d.setDate(d.getDate() + direction);
      if (d <= now) {
        setSelectedDay(getLocalDateStr(d));
      }
    } else if (activeTab === 'monthly') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + direction);
      if (d <= now) {
        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } else if (activeTab === 'weekly') {
      if (direction === -1) {
        setWeekOffset(prev => prev + direction);
      } else {
        const d = new Date();
        d.setDate(d.getDate() + ((weekOffset + direction) * 7));
        if (d <= now) {
          setWeekOffset(prev => prev + direction);
        }
      }
    }
  };

  const getDisplayLabel = () => {
    if (activeTab === 'daily') {
      const d = new Date(selectedDay);
      return d.toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (activeTab === 'monthly') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const d = new Date(y, m - 1);
      return d.toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric' });
    }
    if (activeTab === 'weekly') {
      const d = new Date();
      d.setDate(d.getDate() + (weekOffset * 7));
      const day = d.getDay();
      const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diffToMonday));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `${monday.toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' })}`;
    }
    return '';
  };

  const rangeData = useMemo(() => {
    let startStr: string;
    let endStr: string;
    const now = new Date();

    const todayStr = getLocalDateStr(new Date());

    if (activeTab === 'daily') {
      startStr = selectedDay;
      endStr = selectedDay;
    } else if (activeTab === 'weekly') {
      // Week-to-Date: Start Monday of current week, End Today
      const d = new Date();
      d.setDate(d.getDate() + (weekOffset * 7));
      const day = d.getDay();
      const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diffToMonday);
      
      startStr = getLocalDateStr(monday);
      endStr = weekOffset === 0 ? todayStr : getLocalDateStr(new Date(monday.getTime() + 6 * 86400000));
    } else if (activeTab === 'monthly') {
      // Month-to-Date: Start 1st, End Today (if current month)
      const [y, m] = selectedMonth.split('-').map(Number);
      startStr = `${y}-${String(m).padStart(2, '0')}-01`;
      
      const currentMonthStr = todayStr.substring(0, 7);
      if (selectedMonth === currentMonthStr) {
        endStr = todayStr;
      } else {
        const lastDayDate = new Date(y, m, 0);
        endStr = getLocalDateStr(lastDayDate);
      }
    } else {
      startStr = startDate;
      endStr = endDate;
    }

    // Month-to-Month support: Ensure endStr doesn't come before startStr accidentally
    if (endStr < startStr) {
      endStr = startStr;
    }

    // Precise data filtering
    const filteredJobs = jobs.filter(j => {
      const dStr = j.date.split('T')[0];
      return dStr >= startStr && dStr <= endStr;
    });
    const filteredExpenses = expenses.filter(e => {
      const dStr = e.date.split('T')[0];
      return dStr >= startStr && dStr <= endStr;
    });

    // Day-by-day calculation using string keys for robustness
    const dailyStats: Record<string, { income: number, jobs: number, tips: number, incentive: number }> = {};
    
    // Iterate from start to end day
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    
    // Create UTC-like boundary to avoid DST issues during iteration
    const current = new Date(sy, sm - 1, sd, 12, 0, 0);
    const stopAt = new Date(ey, em - 1, ed, 12, 0, 0);
    
    while (current <= stopAt) {
      const d = getLocalDateStr(current);
      dailyStats[d] = { income: 0, jobs: 0, tips: 0, incentive: incentives[d] || 0 };
      current.setDate(current.getDate() + 1);
    }

    filteredJobs.forEach(j => {
      const d = j.date.split('T')[0];
      if (dailyStats[d]) {
        const amountToCollect = j.customerMustPay + j.upfrontCost;
        const actual = j.actualReceived ?? amountToCollect;
        const diff = actual - amountToCollect;
        const tip = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        dailyStats[d].jobs += j.appNetIncome - loss;
        dailyStats[d].tips += tip;
      }
    });

    let totalTips = 0;
    let workDays = 0;
    let offDays = 0;

    Object.keys(dailyStats).forEach(d => {
      const s = dailyStats[d];
      s.income = Math.max(0, s.jobs + s.tips + s.incentive);
      totalTips += s.tips;
      
      // Since endStr is already capped at today for MTD, we count all dates in dailyStats
      if (s.income > 800) {
        workDays++;
      } else {
        offDays++;
      }
    });

    const totalIncome = Object.values(dailyStats).reduce((sum, s) => sum + s.income, 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    const categoryStats: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const cat = e.category || 'อื่นๆ';
      categoryStats[cat] = (categoryStats[cat] || 0) + (e.amount || 0);
    });

    const categoryStatsList = Object.entries(categoryStats)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalTips,
      workDays,
      offDays,
      totalIncome,
      totalExpenses,
      dailyStatsList: Object.entries(dailyStats).map(([date, val]) => ({ date, ...val })).sort((a, b) => a.date.localeCompare(b.date)),
      categoryStatsList,
      startStr,
      endStr,
      todayStr
    };
  }, [activeTab, jobs, expenses, incentives, selectedDay, selectedMonth, startDate, endDate, weekOffset]);

  const subTabs: { id: SubTab, label: string }[] = [
    { id: 'daily', label: currentLang === 'th' ? 'รายวัน' : 'Daily' },
    { id: 'weekly', label: currentLang === 'th' ? 'รายสัปดาห์' : 'Weekly' },
    { id: 'monthly', label: currentLang === 'th' ? 'รายเดือน' : 'Monthly' },
    { id: 'custom', label: currentLang === 'th' ? 'กำหนดเอง' : 'Custom' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 pt-2 pb-24 space-y-6">
      {/* Sub-tabs Selection */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl sticky top-2 z-10 shadow-sm border border-slate-200 dark:border-slate-700">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm scale-[0.98]' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Inputs based on sub-tab */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="glass-panel p-4 rounded-3xl"
        >
          {activeTab === 'daily' && (
            <div className="flex items-center justify-between">
              <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><ChevronLeft className="w-5 h-5 text-slate-500" /></button>
              <span className="text-sm font-black text-slate-800 dark:text-white">{getDisplayLabel()}</span>
              <button disabled={new Date(selectedDay).toDateString() === new Date().toDateString()} onClick={() => navigateDate(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded-full"><ChevronRight className="w-5 h-5 text-slate-500" /></button>
            </div>
          )}
          {activeTab === 'monthly' && (
            <div className="flex items-center justify-between">
              <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><ChevronLeft className="w-5 h-5 text-slate-500" /></button>
              <span className="text-sm font-black text-slate-800 dark:text-white">{getDisplayLabel()}</span>
              <button disabled={selectedMonth === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`} onClick={() => navigateDate(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded-full"><ChevronRight className="w-5 h-5 text-slate-500" /></button>
            </div>
          )}
          {activeTab === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">เริ่มต้น</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">สิ้นสุด</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          )}
          {activeTab === 'weekly' && (
            <div className="flex items-center justify-between">
              <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><ChevronLeft className="w-5 h-5 text-slate-500" /></button>
              <span className="text-sm font-black text-slate-800 dark:text-white">{getDisplayLabel()}</span>
              <button disabled={weekOffset === 0} onClick={() => navigateDate(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded-full"><ChevronRight className="w-5 h-5 text-slate-500" /></button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Main Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-6 rounded-[2rem] border-b-4 border-amber-500 relative overflow-hidden group col-span-2 lg:col-span-1"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors" />
          <div className="relative flex flex-col items-center text-center space-y-3">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">ทิปที่ได้</p>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-1">
                ฿{rangeData.totalTips.toLocaleString()}
              </h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-6 rounded-[2rem] border-b-4 border-rose-500 relative overflow-hidden group"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors" />
          <div className="relative flex flex-col items-center text-center space-y-3">
            <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">หยุดไปกี่วัน</p>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-1">
                {rangeData.offDays} <span className="text-sm font-bold text-slate-400 ml-1">วัน</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-bold">(รายได้ {'<='} 800)</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-6 rounded-[2rem] border-b-4 border-emerald-500 relative overflow-hidden group"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          <div className="relative flex flex-col items-center text-center space-y-3">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">ทำงานกี่วัน</p>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-1">
                {rangeData.workDays} <span className="text-sm font-bold text-slate-400 ml-1">วัน</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-bold">(รายได้ {'>'} 800)</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Secondary Stats Group */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-4 rounded-3xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">รายรับรวม</p>
            <p className="text-lg font-black text-emerald-600">฿{rangeData.totalIncome.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
        <div className="glass-panel p-4 rounded-3xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">รายจ่ายรวม</p>
            <p className="text-lg font-black text-rose-600">฿{rangeData.totalExpenses.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-rose-500" />
          </div>
        </div>
      </div>

      {/* Daily Income Chart */}
      {activeTab !== 'daily' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6 rounded-[2rem]"
        >
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-widest">
              <Calendar className="w-4 h-4 text-indigo-500" />
              แนวโน้มรายได้รายวัน
            </h4>
            <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/40 rounded-full">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">เป้าหมาย 800+</span>
            </div>
          </div>
          <div className="h-[250px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rangeData.dailyStatsList}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }}
                  tickFormatter={(val) => val.split('-')[2]} // Day number
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px' }}
                />
                <Bar dataKey="income" name="รายได้รวม" radius={[4, 4, 0, 0]}>
                  {rangeData.dailyStatsList.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.income > 800 ? '#10b981' : '#f43f5e'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ทำงาน ({'>'}800)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f43f5e' }} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">หยุด ({'<='}800)</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Category Expenses Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-6 rounded-[2rem] mt-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-widest">
            <Filter className="w-4 h-4 text-rose-500" />
            รายจ่ายตามหมวดหมู่
          </h4>
        </div>
        
        {rangeData.categoryStatsList.length > 0 ? (
          <div className="h-[250px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rangeData.categoryStatsList} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                <YAxis type="category" dataKey="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} width={80} />
                <Tooltip 
                  cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  formatter={(value: number) => [`฿${value.toLocaleString()}`, 'ยอดรวมรายจ่าย']}
                />
                <Bar dataKey="amount" name="ยอดรวม" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-3">
              <TrendingDown className="w-6 h-6 opacity-50" />
            </div>
            <p className="text-xs font-bold text-center">ไม่มีข้อมูลรายจ่ายในช่วงเวลานี้</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
