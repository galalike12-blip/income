import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Filter
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { JobEntry, ExpenseEntry } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';

interface SummaryProps {
  jobs: JobEntry[];
  expenses: ExpenseEntry[];
  incentives: Record<string, number>;
}

type RangeType = 'custom' | 'monthly' | 'ytd';

export function Summary({ jobs, expenses, incentives }: SummaryProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const [rangeType, setRangeType] = useState<RangeType>('monthly');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());

  const filteredData = useMemo(() => {
    let start: Date;
    let end: Date;

    if (rangeType === 'monthly') {
      start = new Date(`${selectedMonth}-01`);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    } else if (rangeType === 'ytd') {
      const now = new Date();
      start = new Date(now.getFullYear(), 0, 1); // Jan 1st of current year
      end = now;
    } else {
      start = new Date(startDate);
      end = new Date(endDate);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const filteredJobs = jobs.filter(j => {
      const d = new Date(j.date);
      return d >= start && d <= end;
    });

    const filteredExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });

    return { filteredJobs, filteredExpenses, start, end };
  }, [jobs, expenses, rangeType, startDate, endDate, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    const { filteredJobs, filteredExpenses } = filteredData;

    let totalIncome = 0;
    let totalTips = 0;
    let totalAppNet = 0;

    filteredJobs.forEach(j => {
      const amountToCollect = j.customerMustPay + j.upfrontCost;
      const diff = (j.actualReceived ?? amountToCollect) - amountToCollect;
      const tip = diff > 0 ? diff : 0;
      totalIncome += j.appNetIncome + diff;
      totalTips += tip;
      totalAppNet += j.appNetIncome;
    });

    // Add incentives in the range
    const { start, end } = filteredData;
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dailyIncentive = incentives[dateStr] || 0;
      totalIncome += dailyIncentive;
      current.setDate(current.getDate() + 1);
    }

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netBalance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

    // Expense by category
    const expenseByCategory: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const cat = e.category;
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + e.amount;
    });

    const expensePieData = Object.entries(expenseByCategory).map(([name, value]) => ({
      name: t[name as keyof typeof t] || name,
      value
    })).sort((a, b) => b.value - a.value);

    // Income breakdown
    const incomePieData = [
      { name: t.appNetIncome || 'App Net', value: totalAppNet },
      { name: t.tipCalculated || 'Tips', value: totalTips }
    ].filter(d => d.value > 0);

    // Group by time for bar chart
    const timeGroups: Record<string, { income: number, expense: number }> = {};
    
    // Determine grouping key based on range
    const isCustomLong = rangeType === 'custom' && (filteredData.end.getTime() - filteredData.start.getTime() > 40 * 24 * 60 * 60 * 1000);

    const getGroupKey = (dateStr: string) => {
      if (rangeType === 'ytd' || isCustomLong) return dateStr.slice(0, 7); // YYYY-MM
      return dateStr; // YYYY-MM-DD
    };

    filteredJobs.forEach(j => {
      const key = getGroupKey(j.date);
      if (!timeGroups[key]) timeGroups[key] = { income: 0, expense: 0 };
      const amountToCollect = j.customerMustPay + j.upfrontCost;
      const diff = (j.actualReceived ?? amountToCollect) - amountToCollect;
      timeGroups[key].income += j.appNetIncome + diff;
    });

    // Add incentives to timeGroups
    const curr = new Date(start);
    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      const dailyIncentive = incentives[dateStr] || 0;
      if (dailyIncentive > 0) {
        const key = getGroupKey(dateStr);
        if (!timeGroups[key]) timeGroups[key] = { income: 0, expense: 0 };
        timeGroups[key].income += dailyIncentive;
      }
      curr.setDate(curr.getDate() + 1);
    }

    filteredExpenses.forEach(e => {
      const key = getGroupKey(e.date);
      if (!timeGroups[key]) timeGroups[key] = { income: 0, expense: 0 };
      timeGroups[key].expense += e.amount;
    });

    const chartData = Object.entries(timeGroups).map(([date, vals]) => ({
      date,
      ...vals
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalIncome,
      totalExpenses,
      netBalance,
      savingsRate,
      expensePieData,
      incomePieData,
      chartData,
      topExpenses: [...filteredExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5),
      topIncomeDays: [...filteredJobs].sort((a, b) => b.appNetIncome - a.appNetIncome).slice(0, 5)
    };
  }, [filteredData, t, rangeType]);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

  return (
    <div className="max-w-5xl mx-auto px-4 pt-2 pb-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 glass-panel p-4 rounded-3xl transition-colors overflow-hidden">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white text-center sm:text-left">{t.summary || 'Summary'}</h1>
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
          <button 
            onClick={() => {
              setRangeType('monthly');
              // Optionally set custom range to today if needed, but monthly is more common for "Today" in summary
            }}
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100/80 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-2xl transition-colors backdrop-blur-sm"
          >
            {t.today || 'วันนี้'}
          </button>
        </div>
      </div>

      {/* Range Selector */}
      <div className="glass-panel p-4 rounded-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Filter className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t.selectRange || 'Select Range'}</h2>
          </div>
          
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setRangeType('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${rangeType === 'monthly' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {t.monthly || 'Monthly'}
            </button>
            <button 
              onClick={() => setRangeType('ytd')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${rangeType === 'ytd' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {t.yearToDate || 'YTD'}
            </button>
            <button 
              onClick={() => setRangeType('custom')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${rangeType === 'custom' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {t.customRange || 'Custom'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          {rangeType === 'monthly' && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-1">{t.customMonth || 'Month'}</label>
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          )}
          {rangeType === 'custom' && (
            <>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-1">{t.startDate || 'Start Date'}</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-1">{t.endDate || 'End Date'}</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-panel p-4 rounded-3xl border-l-4 border-emerald-500"
        >
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{t.totalIncome || 'Total Income'}</span>
          </div>
          <div className="text-xl font-black text-slate-800 dark:text-slate-100">฿{stats.totalIncome.toLocaleString()}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-4 rounded-3xl border-l-4 border-rose-500"
        >
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{t.totalExpensesSummary || 'Total Expenses'}</span>
          </div>
          <div className="text-xl font-black text-slate-800 dark:text-slate-100">฿{stats.totalExpenses.toLocaleString()}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-4 rounded-3xl border-l-4 border-indigo-500"
        >
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
            <Wallet className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{t.netBalance || 'Net Balance'}</span>
          </div>
          <div className={`text-xl font-black ${stats.netBalance >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-rose-600'}`}>
            ฿{stats.netBalance.toLocaleString()}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="glass-panel p-4 rounded-3xl border-l-4 border-amber-500"
        >
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
            <PieChartIcon className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{t.savingsRate || 'Savings Rate'}</span>
          </div>
          <div className="text-xl font-black text-slate-800 dark:text-slate-100">{stats.savingsRate.toFixed(1)}%</div>
        </motion.div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Bar Chart */}
        <div className="glass-panel p-6 rounded-3xl">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            {t.incomeVsExpenses || 'Income vs Expenses'}
          </h3>
          <div className="h-[300px] w-full min-w-0 relative">
            {stats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(val) => {
                      if (val.length > 7) return val.slice(8, 10); // Just day
                      return val;
                    }}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                  <Bar dataKey="income" name={t.income || 'Income'} fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name={t.expenses || 'Expenses'} fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                {t.noDataForRange || 'No data for this range'}
              </div>
            )}
          </div>
        </div>

        {/* Expense Breakdown Pie Chart */}
        <div className="glass-panel p-6 rounded-3xl">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-indigo-500" />
            {t.expenseBreakdown || 'Expense Breakdown'}
          </h3>
          <div className="h-[300px] w-full min-w-0 relative">
            {stats.expensePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.expensePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.expensePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => `฿${value.toLocaleString()}`}
                  />
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                {t.noDataForRange || 'No data for this range'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Top Expenses List */}
        <div className="glass-panel p-6 rounded-3xl">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-500" />
            {t.topExpenses || 'Top Expenses'}
          </h3>
          <div className="space-y-2">
            {stats.topExpenses.length > 0 ? (
              stats.topExpenses.map((e, i) => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[100px]">{e.payee || t[e.category as keyof typeof t] || e.category}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{e.date}</div>
                    </div>
                  </div>
                  <div className="text-sm font-black text-rose-600 dark:text-rose-400">฿{e.amount.toLocaleString()}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm italic">
                {t.noDataForRange || 'No data for this range'}
              </div>
            )}
          </div>
        </div>

        {/* Top Income Days */}
        <div className="glass-panel p-6 rounded-3xl">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            {t.topIncomeSources || 'Top Income Days'}
          </h3>
          <div className="space-y-2">
            {stats.topIncomeDays.length > 0 ? (
              stats.topIncomeDays.map((j, i) => (
                <div key={j.id} className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{j.date}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{t.income || 'Income'}</div>
                    </div>
                  </div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">฿{j.appNetIncome.toLocaleString()}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm italic">
                {t.noDataForRange || 'No data for this range'}
              </div>
            )}
          </div>
        </div>

        {/* Financial Health / Insights */}
        <div className="glass-panel p-6 rounded-3xl">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            {t.financialHealth || 'Financial Health'}
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">{t.insights || 'Insights'}</div>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <span>
                    {currentLang === 'th' 
                      ? `คุณมีรายรับทั้งหมด ฿${stats.totalIncome.toLocaleString()} และรายจ่าย ฿${stats.totalExpenses.toLocaleString()}`
                      : `You have a total income of ฿${stats.totalIncome.toLocaleString()} and expenses of ฿${stats.totalExpenses.toLocaleString()}.`}
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <span>
                    {stats.savingsRate > 20 
                      ? (currentLang === 'th' ? 'อัตราการออมของคุณดีมาก! รักษามาตรฐานนี้ไว้' : 'Your savings rate is excellent! Keep it up.')
                      : (currentLang === 'th' ? 'ลองพิจารณาลดรายจ่ายฟุ่มเฟือยเพื่อเพิ่มอัตราการออม' : 'Consider reducing luxury expenses to increase your savings rate.')}
                  </span>
                </li>
                {stats.totalExpenses > stats.totalIncome && (
                  <li className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400 font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span>
                      {currentLang === 'th' 
                        ? 'คำเตือน: รายจ่ายของคุณสูงกว่ารายรับในช่วงเวลานี้'
                        : 'Warning: Your expenses are higher than your income in this period.'}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/30">
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">{t.balance || 'Balance'}</div>
              <div className="text-lg font-black text-slate-700 dark:text-slate-200">฿{stats.netBalance.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
