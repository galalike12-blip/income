import React, { useState, useMemo } from 'react';
import { JobEntry, ExpenseEntry } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';

export function Charts({ jobs, incentives, expenses = [] }: { jobs: JobEntry[], incentives: Record<string, number>, expenses?: ExpenseEntry[] }) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'yearly'>('daily');

  const [dateRangeType, setDateRangeType] = useState<'all' | 'month' | 'year' | 'custom' | 'custom-month' | 'custom-year'>('month');
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [selectedYear, setSelectedYear] = useState(`${new Date().getFullYear()}`);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [startMonth, setStartMonth] = useState(`${new Date().getFullYear()}-01`);
  const [endMonth, setEndMonth] = useState(`${new Date().getFullYear()}-12`);
  const [startYear, setStartYear] = useState(`${new Date().getFullYear() - 1}`);
  const [endYear, setEndYear] = useState(`${new Date().getFullYear()}`);

  const isDateInRange = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (dateStr > today) return false;

    if (dateRangeType === 'all') return true;
    if (dateRangeType === 'month') return dateStr.startsWith(selectedMonth);
    if (dateRangeType === 'year') return dateStr.startsWith(selectedYear);
    if (dateRangeType === 'custom') return dateStr >= startDate && dateStr <= endDate;
    if (dateRangeType === 'custom-month') {
      const monthStr = dateStr.substring(0, 7);
      return monthStr >= startMonth && monthStr <= endMonth;
    }
    if (dateRangeType === 'custom-year') {
      const yearStr = dateStr.substring(0, 4);
      return yearStr >= startYear && yearStr <= endYear;
    }
    return true;
  };

  const filteredJobs = useMemo(() => jobs.filter(j => isDateInRange(j.date)), [jobs, dateRangeType, selectedMonth, selectedYear, startDate, endDate, startMonth, endMonth, startYear, endYear]);
  const filteredIncentives = useMemo(() => {
    const result: Record<string, number> = {};
    Object.entries(incentives).forEach(([date, amount]) => {
      if (isDateInRange(date)) result[date] = amount;
    });
    return result;
  }, [incentives, dateRangeType, selectedMonth, selectedYear, startDate, endDate, startMonth, endMonth, startYear, endYear]);
  const filteredExpenses = useMemo(() => expenses.filter(e => isDateInRange(e.date)), [expenses, dateRangeType, selectedMonth, selectedYear, startDate, endDate, startMonth, endMonth, startYear, endYear]);

  const chartData = useMemo(() => {
    const groups: Record<string, { name: string; netIncome: number; tips: number; expenses: number; losses: number }> = {};

    const initGroup = (dateStr: string) => {
      const dateObj = new Date(dateStr);
      let key = '';
      let name = '';

      if (viewMode === 'daily') {
        key = dateStr;
        name = dateObj.toLocaleDateString(currentLang, { month: 'short', day: 'numeric' });
      } else if (viewMode === 'monthly') {
        key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        name = dateObj.toLocaleDateString(currentLang, { year: 'numeric', month: 'short' });
      } else {
        key = `${dateObj.getFullYear()}`;
        name = `${dateObj.getFullYear()}`;
      }

      if (!groups[key]) {
        groups[key] = { name, netIncome: 0, tips: 0, expenses: 0, losses: 0 };
      }
      return key;
    };

    filteredJobs.forEach(job => {
      const key = initGroup(job.date);
      const amountToCollect = job.customerMustPay + job.upfrontCost;
      const diff = (job.actualReceived ?? amountToCollect) - amountToCollect;
      const tip = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      const net = job.appNetIncome + diff;

      groups[key].netIncome += net;
      groups[key].tips += tip;
      groups[key].losses += loss;
    });

    Object.entries(filteredIncentives).forEach(([dateStr, amount]) => {
      if (amount > 0) {
        const key = initGroup(dateStr);
        groups[key].netIncome += amount;
      }
    });

    filteredExpenses.forEach(expense => {
      const key = initGroup(expense.date);
      groups[key].expenses += expense.amount;
    });

    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(entry => entry[1]);
  }, [filteredJobs, filteredIncentives, filteredExpenses, viewMode, currentLang]);

  const expensePieData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    filteredExpenses.forEach(exp => {
      const cat = exp.category;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
    });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

  const getCategoryName = (cat: string) => {
    switch(cat) {
      case 'food': return t.food || 'ค่าอาหาร/เครื่องดื่ม';
      case 'fuel': return t.fuel || 'ค่าน้ำมัน/เดินทาง';
      case 'rent': return t.rent || 'ค่าเช่า/ที่พัก';
      case 'utilities': return t.utilities || 'ค่าน้ำ/ค่าไฟ/เน็ต';
      case 'shopping': return t.shopping || 'ช็อปปิ้ง/ของใช้ส่วนตัว';
      case 'maintenance': return t.maintenance || 'ค่าซ่อมบำรุง';
      case 'other': return t.other || 'อื่นๆ';
      default: return cat;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Date Range Filter */}
      <div className="glass-panel p-6 rounded-3xl">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex glass-panel-subtle p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            <button onClick={() => setDateRangeType('all')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${dateRangeType === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>
              {t.allTime || 'ทั้งหมด'}
            </button>
            <button onClick={() => setDateRangeType('month')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${dateRangeType === 'month' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>
              {t.monthly || 'รายเดือน'}
            </button>
            <button onClick={() => setDateRangeType('year')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${dateRangeType === 'year' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>
              {t.yearly || 'รายปี'}
            </button>
            <button onClick={() => setDateRangeType('custom')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${dateRangeType === 'custom' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>
              {t.customDate || 'กำหนดวัน'}
            </button>
            <button onClick={() => setDateRangeType('custom-month')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${dateRangeType === 'custom-month' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>
              {t.customMonth || 'กำหนดเดือน'}
            </button>
            <button onClick={() => setDateRangeType('custom-year')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${dateRangeType === 'custom-year' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>
              {t.customYear || 'กำหนดปี'}
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {dateRangeType === 'month' && (
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="px-4 py-2 glass-input rounded-xl w-full sm:w-auto" />
            )}
            {dateRangeType === 'year' && (
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="px-4 py-2 glass-input rounded-xl w-full sm:w-auto">
                {Array.from({ length: 5 }).map((_, i) => {
                  const year = (new Date().getFullYear() - i).toString();
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
            )}
            {dateRangeType === 'custom' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2 glass-input rounded-xl w-full" />
                <span className="text-slate-500">-</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2 glass-input rounded-xl w-full" />
              </div>
            )}
            {dateRangeType === 'custom-month' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)} className="px-3 py-2 glass-input rounded-xl w-full" />
                <span className="text-slate-500">-</span>
                <input type="month" value={endMonth} onChange={e => setEndMonth(e.target.value)} className="px-3 py-2 glass-input rounded-xl w-full" />
              </div>
            )}
            {dateRangeType === 'custom-year' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select value={startYear} onChange={e => setStartYear(e.target.value)} className="px-3 py-2 glass-input rounded-xl w-full">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const year = (new Date().getFullYear() - i).toString();
                    return <option key={year} value={year}>{year}</option>;
                  })}
                </select>
                <span className="text-slate-500">-</span>
                <select value={endYear} onChange={e => setEndYear(e.target.value)} className="px-3 py-2 glass-input rounded-xl w-full">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const year = (new Date().getFullYear() - i).toString();
                    return <option key={year} value={year}>{year}</option>;
                  })}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 sm:p-8 rounded-3xl transition-colors">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t.incomeComparison}</h2>
          <div className="flex glass-panel-subtle p-1 rounded-full">
            {(['daily', 'monthly', 'yearly'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${viewMode === mode ? 'bg-white/80 dark:bg-slate-700/80 text-indigo-600 dark:text-indigo-400 shadow-sm backdrop-blur-md' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {t[mode]}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-4">
          {chartData.length > 0 ? (
            <div style={{ minWidth: `max(100%, ${chartData.length * 80}px)`, height: '320px' }} className="relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} maxBarSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `฿${value}`} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="netIncome" name={t.netIncome} fill="#4f46e5" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="tips" name={t.totalTips} fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="losses" name={t.losses || "ขาดทุน"} fill="#f97316" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="expenses" name={t.expenses || "Expenses"} fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-slate-500 dark:text-slate-400">
              {t.noEntries}
            </div>
          )}
        </div>
      </div>

      {expenses.length > 0 && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl transition-colors">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-8">{t.expenseCharts || 'กราฟรายจ่าย'}</h2>
          <div className="w-full h-[320px] sm:h-[400px] min-w-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensePieData}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  outerRadius="65%"
                  innerRadius="40%"
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                    if (percent < 0.05) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                >
                  {expensePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `฿${value.toLocaleString()}`}
                  labelFormatter={(label) => getCategoryName(label as string)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend 
                  formatter={(value) => getCategoryName(value)} 
                  layout="horizontal" 
                  verticalAlign="bottom" 
                  align="center"
                  wrapperStyle={{ paddingTop: '20px', paddingBottom: '20px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
