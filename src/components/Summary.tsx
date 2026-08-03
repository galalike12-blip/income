import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
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
  ChevronRight,
  Settings2,
  GripVertical,
  Circle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';
import { JobEntry, ExpenseEntry, ActivityLog } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface SummaryProps {
  jobs: JobEntry[];
  expenses: ExpenseEntry[];
  incentives: Record<string, number>;
  rawIncentives?: Record<string, any>;
  expenseBalance: number;
  logs?: ActivityLog[];
  showSettings?: boolean;
  onToggleSettings?: () => void;
  preferences?: any;
}

type SubTab = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export function Summary({ 
  jobs, 
  expenses, 
  incentives, 
  rawIncentives = {}, 
  expenseBalance, 
  logs = [],
  showSettings = false,
  onToggleSettings,
  preferences = {}
}: SummaryProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const workType = preferences?.workType || 'rider';
  const riderMinDaily = preferences?.riderMinDailyTarget ?? 800;

  const [activeTab, setActiveTab] = useState<SubTab>('monthly');
  const [cardVisibility, setCardVisibility] = useLocalStorage('summary-card-visibility', {
    tips: true,
    offDays: true,
    workDays: true,
    secondaryStats: true,
    dailyChart: true,
    categoryChart: true,
    comparison: true
  });
  const [cardOrder, setCardOrder] = useLocalStorage('summary-card-order', [
    'tips', 'offDays', 'workDays', 'secondaryStats', 'dailyChart', 'categoryChart', 'comparison'
  ]);
  
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
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());

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
    } else if (activeTab === 'yearly') {
      const y = parseInt(selectedYear);
      const d = new Date(y + direction, 0, 1);
      if (d.getFullYear() <= now.getFullYear()) {
        setSelectedYear(d.getFullYear().toString());
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
    if (activeTab === 'yearly') {
      return selectedYear;
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

  const earliestActivityDate = useMemo(() => {
    let earliest = '9999-12-31';
    jobs.forEach(j => { if (j.date < earliest) earliest = j.date; });
    expenses.forEach(e => { if (e.date < earliest) earliest = e.date; });
    Object.keys(incentives).forEach(d => { if (d < earliest) earliest = d; });
    Object.keys(rawIncentives || {}).forEach(d => { if (d < earliest) earliest = d; });
    return earliest === '9999-12-31' ? null : earliest;
  }, [jobs, expenses, incentives, rawIncentives]);

  const rangeData = useMemo(() => {
    let startStr: string;
    let endStr: string;
    let compStartStr: string | null = null;
    let compEndStr: string | null = null;
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
      
      // Comparison: up to same day of the previous month
      const diffDays = Math.ceil((new Date(endStr).getTime() - new Date(startStr).getTime()) / 86400000) + 1;
      let prevM = m - 1;
      let prevY = y;
      if (prevM === 0) {
        prevM = 12;
        prevY--;
      }
      compStartStr = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
      const compEndDate = new Date(prevY, prevM - 1, diffDays);
      const lastDayOfPrevMonth = new Date(prevY, prevM, 0);
      compEndStr = getLocalDateStr(compEndDate > lastDayOfPrevMonth ? lastDayOfPrevMonth : compEndDate);

    } else if (activeTab === 'yearly') {
      // Year-to-Date: Start Jan 1st, End Today (if current year)
      const y = parseInt(selectedYear);
      startStr = `${y}-01-01`;
      
      if (selectedYear === now.getFullYear().toString()) {
        endStr = todayStr;
      } else {
        endStr = `${y}-12-31`;
      }
      
      // Comparison: up to same day of the previous year
      const diffDays = Math.ceil((new Date(endStr).getTime() - new Date(startStr).getTime()) / 86400000) + 1;
      const prevY = y - 1;
      compStartStr = `${prevY}-01-01`;
      const compEndDate = new Date(prevY, 0, diffDays);
      const lastDayOfPrevYear = new Date(prevY, 11, 31);
      compEndStr = getLocalDateStr(compEndDate > lastDayOfPrevYear ? lastDayOfPrevYear : compEndDate);

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
    
    // Previous period filtering for comparison
    let prevTransferredIncome = 0;
    let prevTotalExpenses = 0;
    let prevTotalIncome = 0;
    let prevBalance = expenseBalance;

    const getHistoricalBalanceForDate = (targetDateStr: string): number => {
      if (targetDateStr >= todayStr) {
        return Math.max(0, expenseBalance);
      }

      const rawDailyBalances = preferences?.dailyBalances;

      // 1. Direct snapshot check on targetDateStr from dailyBalances
      if (rawDailyBalances && rawDailyBalances[targetDateStr] !== undefined && rawDailyBalances[targetDateStr] !== null) {
        return Math.max(0, Number(rawDailyBalances[targetDateStr]) || 0);
      }

      // 2. Direct snapshot check on targetDateStr from paid expenses with balanceAfter
      const targetExpensesWithBalance = expenses.filter(e => 
        e.date.startsWith(targetDateStr) && 
        e.isPaid !== false && 
        e.balanceAfter !== undefined && 
        e.balanceAfter !== null
      );
      if (targetExpensesWithBalance.length > 0) {
        const lastExp = targetExpensesWithBalance[targetExpensesWithBalance.length - 1];
        return Math.max(0, Number(lastExp.balanceAfter) || 0);
      }

      // 3. Collect consolidated snapshots per date
      const snapshotsMap: Record<string, number> = {};

      // Paid expenses
      expenses.forEach(e => {
        if (e.isPaid !== false && e.balanceAfter !== undefined && e.balanceAfter !== null) {
          const dStr = e.date.split('T')[0];
          snapshotsMap[dStr] = Math.max(0, Number(e.balanceAfter) || 0);
        }
      });

      // Daily balances override / supplement
      if (rawDailyBalances) {
        Object.entries(rawDailyBalances).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            snapshotsMap[k] = Math.max(0, Number(v) || 0);
          }
        });
      }

      const getNetChangeBetween = (fromDateExclusive: string, toDateInclusive: string) => {
        let transfers = 0;
        const sortedTransferLogs = logs.filter(l => l.type === 'transfer_income').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        const firstTransferLogTime = sortedTransferLogs.length > 0 ? sortedTransferLogs[0].timestamp : '9999-99-99T99:99';

        sortedTransferLogs.forEach(l => {
          const logDate = l.timestamp.split('T')[0];
          if (logDate > fromDateExclusive && logDate <= toDateInclusive) {
            transfers += (l.amount || 0);
          }
        });

        jobs.filter(j => {
          const dStr = j.date.split('T')[0];
          return dStr > fromDateExclusive && dStr <= toDateInclusive && j.transferred && j.date < firstTransferLogTime;
        }).forEach(j => {
          const amountToCollect = j.customerMustPay + j.upfrontCost;
          const actual = j.actualReceived ?? amountToCollect;
          const diff = actual - amountToCollect;
          const tip = diff > 0 ? diff : 0;
          const loss = diff < 0 ? Math.abs(diff) : 0;
          transfers += (j.appNetIncome - loss + tip);
        });

        Object.entries(rawIncentives || {}).forEach(([d, inc]) => {
          if (d > fromDateExclusive && d <= toDateInclusive && inc && typeof inc !== 'number' && inc.transferred && d < firstTransferLogTime.split('T')[0]) {
            transfers += inc.amount;
          }
        });

        let paidExpenses = 0;
        expenses.filter(e => {
          const dStr = e.date.split('T')[0];
          return dStr > fromDateExclusive && dStr <= toDateInclusive && e.isPaid !== false;
        }).forEach(e => {
          paidExpenses += e.amount;
        });

        return transfers - paidExpenses;
      };

      const snapshotDates = Object.keys(snapshotsMap).sort();

      // Find closest snapshot before targetDateStr
      const datesBefore = snapshotDates.filter(d => d < targetDateStr);
      if (datesBefore.length > 0) {
        const closestBefore = datesBefore[datesBefore.length - 1];
        const baseBal = snapshotsMap[closestBefore];
        const netChange = getNetChangeBetween(closestBefore, targetDateStr);
        return Math.max(0, baseBal + netChange);
      }

      // Find closest snapshot after targetDateStr
      const datesAfter = snapshotDates.filter(d => d > targetDateStr);
      if (datesAfter.length > 0) {
        const closestAfter = datesAfter[0];
        const baseBal = snapshotsMap[closestAfter];
        const netChange = getNetChangeBetween(targetDateStr, closestAfter);
        return Math.max(0, baseBal - netChange);
      }

      // Fallback: calculate backward from current expenseBalance
      const netChangeAfterTarget = getNetChangeBetween(targetDateStr, todayStr);
      return Math.max(0, expenseBalance - netChangeAfterTarget);
    };

    if (compStartStr && compEndStr) {
      const prevJobs = jobs.filter(j => {
        const dStr = j.date.split('T')[0];
        return dStr >= compStartStr! && dStr <= compEndStr!;
      });
      const prevExps = expenses.filter(e => {
        const dStr = e.date.split('T')[0];
        return dStr >= compStartStr! && dStr <= compEndStr!;
      });
      
      prevTotalExpenses = prevExps.reduce((sum, e) => {
        const isActuallyPaid = e.isPaid !== false;
        return sum + (isActuallyPaid ? e.amount : 0);
      }, 0);

      const prevDailyStatsForIncome: Record<string, number> = {};

      prevJobs.forEach(j => {
        const d = j.date.split('T')[0];
        const amountToCollect = j.customerMustPay + j.upfrontCost;
        const actual = j.actualReceived ?? amountToCollect;
        const diff = actual - amountToCollect;
        const tip = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        prevDailyStatsForIncome[d] = (prevDailyStatsForIncome[d] || 0) + (j.appNetIncome - loss + tip);

        if (j.transferred) {
          prevTransferredIncome += (j.appNetIncome - loss + tip);
        }
      });

      const [psy, psm, psd] = compStartStr.split('-').map(Number);
      const [pey, pem, ped] = compEndStr.split('-').map(Number);
      const pCurrent = new Date(psy, psm - 1, psd, 12, 0, 0);
      const pStop = new Date(pey, pem - 1, ped, 12, 0, 0);
      while(pCurrent <= pStop) {
        const d = getLocalDateStr(pCurrent);
        const incData = rawIncentives?.[d];
        if (incData) {
          const incAmount = typeof incData === 'number' ? incData : incData.amount;
          prevDailyStatsForIncome[d] = (prevDailyStatsForIncome[d] || 0) + incAmount;
        }

        if (incData && typeof incData !== 'number' && incData.transferred) {
          prevTransferredIncome += incData.amount;
        }
        pCurrent.setDate(pCurrent.getDate() + 1);
      }

      prevTotalIncome = Object.values(prevDailyStatsForIncome).reduce((sum, val) => sum + Math.max(0, val), 0);

      prevBalance = getHistoricalBalanceForDate(compEndStr!);
    }

    const currentBalanceAtEndStr = getHistoricalBalanceForDate(endStr);

    let currentTransferredIncome = 0;
    filteredJobs.forEach(j => {
      if (j.transferred) {
        const amountToCollect = j.customerMustPay + j.upfrontCost;
        const actual = j.actualReceived ?? amountToCollect;
        const diff = actual - amountToCollect;
        const tip = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        currentTransferredIncome += (j.appNetIncome - loss + tip);
      }
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
      const inc = incentives[d] || 0;
      dailyStats[d] = { income: 0, jobs: 0, tips: 0, incentive: inc };
      
      const rawInc = rawIncentives?.[d];
      if (rawInc && typeof rawInc !== 'number' && rawInc.transferred) {
        currentTransferredIncome += rawInc.amount;
      }

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
    let leaveDays = 0;

    const workType = preferences?.workType || 'rider';
    const riderMinDaily = preferences?.riderMinDailyTarget ?? 800;

    const activeFreelanceDates = new Set<string>();
    filteredJobs.forEach(j => {
      if (j.workType === 'freelance' && j.isMultiDay && j.endDate) {
        const startStr = j.date.split('T')[0];
        const endStr = j.endDate;
        if (startStr <= endStr) {
          let currentDt = new Date(startStr);
          const endDt = new Date(endStr);
          let limit = 0;
          while (currentDt <= endDt && limit < 1000) {
            const yr = currentDt.getFullYear();
            const mo = String(currentDt.getMonth() + 1).padStart(2, '0');
            const dy = String(currentDt.getDate()).padStart(2, '0');
            activeFreelanceDates.add(`${yr}-${mo}-${dy}`);
            currentDt.setDate(currentDt.getDate() + 1);
            limit++;
          }
        }
      }
    });

    Object.keys(dailyStats).forEach(d => {
      const s = dailyStats[d];
      s.income = Math.max(0, s.jobs + s.tips + s.incentive);
      totalTips += s.tips;
      
      const isLeave = preferences?.leaveDays?.includes(d);
      
      if (earliestActivityDate && d >= earliestActivityDate) {
        if (workType === 'salary') {
          const dateObj = new Date(d);
          const dayOfWeek = dateObj.getDay(); // 0 = Sun, 6 = Sat
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          if (isLeave) {
            leaveDays++;
          } else if (isWeekend) {
            if (s.income > 0) {
              workDays++;
            } else {
              offDays++;
            }
          } else {
            // week days default to workDay
            workDays++;
          }
        } else if (workType === 'freelance') {
          if (s.income > 0 || activeFreelanceDates.has(d)) {
            workDays++;
          } else {
            if (isLeave) {
              leaveDays++;
            } else {
              offDays++;
            }
          }
        } else {
          // rider
          if (isLeave) {
            leaveDays++;
            if (s.income > riderMinDaily) workDays++;
          } else {
            if (s.income > riderMinDaily) {
              workDays++;
            } else {
              offDays++;
            }
          }
        }
      }
    });

    const totalIncome = Object.values(dailyStats).reduce((sum, s) => sum + s.income, 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => {
      const isActuallyPaid = e.isPaid !== false;
      return sum + (isActuallyPaid ? e.amount : 0);
    }, 0);

    const categoryStats: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const cat = e.category || 'อื่นๆ';
      categoryStats[cat] = (categoryStats[cat] || 0) + (e.amount || 0);
    });

    const categoryStatsList = Object.entries(categoryStats)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Overlapping Data for Line Chart (Past 4 periods)
    let overlappingData: any[] = [];
    if (activeTab === 'monthly') {
      const currentYearMonth = selectedMonth; // e.g. "2024-06"
      const [curYStr, curMStr] = currentYearMonth.split('-');
      const curY = parseInt(curYStr);
      const curM = parseInt(curMStr) - 1; // 0-indexed month
      
      const periods = Array.from({ length: 4 }, (_, i) => {
        const date = new Date(curY, curM - i, 1);
        return {
          id: i === 0 ? 'เดือนนี้' : i === 1 ? 'เดือนที่แล้ว' : `${i} เดือนที่แล้ว`,
          prefix: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` // prefix to match 'YYYY-MM'
        };
      });

      // Prepare 31 days data structure
      for (let day = 1; day <= 31; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dayObj: any = { day: dayStr };
        // For each period, calculate standard income for that specific day
        periods.forEach((period, idx) => {
          const targetDateStr = `${period.prefix}-${dayStr}`;
          
          let dayIncome = 0;
          
          jobs.filter(j => j.date.startsWith(targetDateStr)).forEach(j => {
            const amountToCollect = j.customerMustPay + j.upfrontCost;
            const actual = j.actualReceived ?? amountToCollect;
            const diff = actual - amountToCollect;
            const tip = diff > 0 ? diff : 0;
            const loss = diff < 0 ? Math.abs(diff) : 0;
            dayIncome += (j.appNetIncome - loss + tip);
          });
          
          Object.entries(rawIncentives || {}).forEach(([d, inc]) => {
            if (d === targetDateStr && inc && typeof inc !== 'number') {
              dayIncome += inc.amount;
            }
          });
          
          dayObj[`v${idx}`] = dayIncome;
        });
        overlappingData.push(dayObj);
      }
    } else if (activeTab === 'yearly') {
      const curY = parseInt(selectedYear);
      const periods = Array.from({ length: 4 }, (_, i) => {
        return {
          id: i === 0 ? 'ปีนี้' : i === 1 ? 'ปีที่แล้ว' : `${i} ปีที่แล้ว`,
          prefix: `${curY - i}` // prefix to match 'YYYY'
        };
      });

      // Prepare 12 months data structure
      for (let m = 1; m <= 12; m++) {
        const monthStr = String(m).padStart(2, '0');
        const mObj: any = { month: monthStr };
        periods.forEach((period, idx) => {
          const targetPrefix = `${period.prefix}-${monthStr}`; // 'YYYY-MM'
          
          let monthIncome = 0;
          
          jobs.filter(j => j.date.startsWith(targetPrefix)).forEach(j => {
            const amountToCollect = j.customerMustPay + j.upfrontCost;
            const actual = j.actualReceived ?? amountToCollect;
            const diff = actual - amountToCollect;
            const tip = diff > 0 ? diff : 0;
            const loss = diff < 0 ? Math.abs(diff) : 0;
            monthIncome += (j.appNetIncome - loss + tip);
          });
          
          Object.entries(rawIncentives || {}).forEach(([d, inc]) => {
            if (d.startsWith(targetPrefix) && inc && typeof inc !== 'number') {
              monthIncome += inc.amount;
            }
          });
          
          mObj[`v${idx}`] = monthIncome;
        });
        overlappingData.push(mObj);
      }
    }

    return {
      totalTips,
      workDays,
      offDays,
      leaveDays,
      totalIncome,
      totalExpenses,
      dailyStatsList: Object.entries(dailyStats).map(([date, val]) => ({ date, ...val })).sort((a, b) => a.date.localeCompare(b.date)),
      categoryStatsList,
      startStr,
      endStr,
      todayStr,
      prevTotalIncome,
      prevTransferredIncome,
      currentTransferredIncome,
      prevTotalExpenses,
      prevBalance,
      currentBalance: currentBalanceAtEndStr,
      overlappingData,
      activeFreelanceDates
    };
  }, [activeTab, jobs, expenses, incentives, rawIncentives, expenseBalance, selectedDay, selectedMonth, selectedYear, startDate, endDate, weekOffset]);

  const subplotPeriods = useMemo(() => {
    if (activeTab === 'monthly') {
      const [curYStr, curMStr] = selectedMonth.split('-');
      const curY = parseInt(curYStr);
      const curM = parseInt(curMStr) - 1; // 0-indexed month
      
      return Array.from({ length: 4 }, (_, i) => {
        const date = new Date(curY, curM - i, 1);
        const monthName = date.toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US', { month: 'short' });
        const label = i === 0 
          ? (currentLang === 'th' ? `เดือนนี้ (${monthName})` : `This Month (${monthName})`)
          : i === 1 
          ? (currentLang === 'th' ? `เดือนที่แล้ว (${monthName})` : `Last Month (${monthName})`)
          : (currentLang === 'th' ? `${monthName} (${date.getFullYear() + 543})` : `${monthName} (${date.getFullYear()})`);
        return {
          key: `v${i}`,
          label,
          color: i === 0 ? '#4f46e5' : i === 1 ? '#0ea5e9' : i === 2 ? '#10b981' : '#f43f5e'
        };
      });
    } else {
      const curY = parseInt(selectedYear);
      return Array.from({ length: 4 }, (_, i) => {
        const yr = curY - i;
        const displayYr = currentLang === 'th' ? yr + 543 : yr;
        const label = i === 0 
          ? (currentLang === 'th' ? `ปีนี้ (${displayYr})` : `This Year (${displayYr})`)
          : i === 1 
          ? (currentLang === 'th' ? `ปีที่แล้ว (${displayYr})` : `Last Year (${displayYr})`)
          : `${displayYr}`;
        return {
          key: `v${i}`,
          label,
          color: i === 0 ? '#4f46e5' : i === 1 ? '#0ea5e9' : i === 2 ? '#10b981' : '#f43f5e'
        };
      });
    }
  }, [activeTab, selectedMonth, selectedYear, currentLang]);

  const maxYValue = useMemo(() => {
    if (!rangeData.overlappingData || rangeData.overlappingData.length === 0) return 1000;
    let maxVal = 0;
    rangeData.overlappingData.forEach(item => {
      ['v0', 'v1', 'v2', 'v3'].forEach(k => {
        const val = item[k];
        if (typeof val === 'number' && val > maxVal) {
          maxVal = val;
        }
      });
    });
    return maxVal > 0 ? Math.ceil(maxVal * 1.1) : 1000;
  }, [rangeData.overlappingData]);

  const subplotTotals = useMemo(() => {
    const totals: Record<string, number> = { v0: 0, v1: 0, v2: 0, v3: 0 };
    if (!rangeData.overlappingData) return totals;
    rangeData.overlappingData.forEach(item => {
      totals.v0 += (item.v0 || 0);
      totals.v1 += (item.v1 || 0);
      totals.v2 += (item.v2 || 0);
      totals.v3 += (item.v3 || 0);
    });
    return totals;
  }, [rangeData.overlappingData]);

  const subTabs: { id: SubTab, label: string }[] = [
    { id: 'daily', label: currentLang === 'th' ? 'รายวัน' : 'Daily' },
    { id: 'weekly', label: currentLang === 'th' ? 'รายสัปดาห์' : 'Weekly' },
    { id: 'monthly', label: currentLang === 'th' ? 'รายเดือน' : 'Monthly' },
    { id: 'yearly', label: currentLang === 'th' ? 'รายปี' : 'Yearly' },
    { id: 'custom', label: currentLang === 'th' ? 'กำหนดเอง' : 'Custom' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 pt-2 pb-24 space-y-6">
      {/* Search Filter Header with Dropdown Interval selector */}
      <div className="flex flex-col gap-3 glass-panel p-4 rounded-3xl transition-colors">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t.summary || 'ภาพรวมและรายงาน'}</h1>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {/* Dropdown Menu block */}
          <div className="relative shrink-0 w-28 sm:w-40">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as SubTab)}
              className="w-full bg-indigo-50/50 hover:bg-indigo-100/80 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold py-2 px-3 pr-8 rounded-2xl border-none appearance-none focus:outline-none focus:ring-0 cursor-pointer transition-colors text-sm backdrop-blur-sm h-[38px]"
            >
              {subTabs.map(tab => (
                <option key={tab.id} value={tab.id} className="text-slate-800 dark:text-slate-200 font-bold">
                  {tab.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-indigo-600 dark:text-indigo-400">
              <ChevronDown className="w-4 h-4 stroke-[2.5px]" />
            </div>
          </div>

          {/* Date and Period Navigators directly embedded */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/50 dark:border-slate-700/50 p-1 px-3 rounded-2xl flex items-center justify-between min-h-[38px]"
              >
                {activeTab === 'daily' && (
                  <>
                    <button onClick={() => navigateDate(-1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate px-2 text-center">{getDisplayLabel()}</span>
                    <button disabled={new Date(selectedDay).toDateString() === new Date().toDateString()} onClick={() => navigateDate(1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded-xl transition-colors cursor-pointer"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
                  </>
                )}
                {activeTab === 'monthly' && (
                  <>
                    <button onClick={() => navigateDate(-1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate px-2 text-center">{getDisplayLabel()}</span>
                    <button disabled={selectedMonth === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`} onClick={() => navigateDate(1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded-xl transition-colors cursor-pointer"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
                  </>
                )}
                {activeTab === 'yearly' && (
                  <>
                    <button onClick={() => navigateDate(-1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate px-2 text-center">{getDisplayLabel()}</span>
                    <button disabled={selectedYear === new Date().getFullYear().toString()} onClick={() => navigateDate(1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded-xl transition-colors cursor-pointer"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
                  </>
                )}
                {activeTab === 'weekly' && (
                  <>
                    <button onClick={() => navigateDate(-1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate px-2 text-center">{getDisplayLabel()}</span>
                    <button disabled={weekOffset === 0} onClick={() => navigateDate(1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded-xl transition-colors cursor-pointer"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
                  </>
                )}
                {activeTab === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 w-full py-0">
                    <div className="flex items-center gap-1.5 bg-slate-100/60 dark:bg-slate-700/50 px-2 py-0.5 rounded-lg flex-1">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">{currentLang === 'th' ? 'เริ่ม' : 'Start'}</span>
                      <input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-[10px] font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none hover:cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100/60 dark:bg-slate-700/50 px-2 py-0.5 rounded-lg flex-1">
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">{currentLang === 'th' ? 'ถึง' : 'End'}</span>
                      <input 
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-[10px] font-bold text-slate-700 dark:text-slate-200 focus:ring-0 outline-none hover:cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <button 
            onClick={onToggleSettings}
            className={`w-[38px] h-[38px] rounded-2xl flex items-center justify-center transition-all shrink-0 border cursor-pointer ${showSettings ? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600' : 'bg-white/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'}`}
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            className="overflow-hidden space-y-6 mb-6"
          >
            <div className="glass-panel p-4 rounded-[2rem] space-y-3 mb-2 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10">
              <h4 className="text-sm font-black text-slate-800 dark:text-white px-2">ตั้งค่าการแสดงผลหน้าสรุป</h4>
              <Reorder.Group axis="y" values={cardOrder} onReorder={setCardOrder} className="space-y-2">
                {[
                  { key: 'tips', label: 'ทิปที่ได้', icon: <Coins className="w-4 h-4" /> },
                  { key: 'offDays', label: 'วันหยุด', icon: <XCircle className="w-4 h-4" /> },
                  { key: 'workDays', label: 'วันทำงาน', icon: <CheckCircle2 className="w-4 h-4" /> },
                  { key: 'secondaryStats', label: 'รายรับ/รายจ่ายรวม', icon: <TrendingUp className="w-4 h-4" /> },
                  { key: 'dailyChart', label: 'กราฟรายวัน', icon: <Calendar className="w-4 h-4" /> },
                  { key: 'categoryChart', label: 'กราฟหมวดหมู่', icon: <Filter className="w-4 h-4" /> },
                  { key: 'comparison', label: 'เปรียบเทียบ', icon: <TrendingUp className="w-4 h-4" /> },
                ].sort((a,b) => cardOrder.indexOf(a.key) - cardOrder.indexOf(b.key)).map((item) => (
                  <Reorder.Item key={item.key} value={item.key} className={`p-3 rounded-2xl flex items-center gap-3 transition-colors ${cardVisibility[item.key as keyof typeof cardVisibility] ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white' : 'bg-white/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500'}`}>
                    <div 
                      onClick={() => setCardVisibility({...cardVisibility, [item.key]: !cardVisibility[item.key as keyof typeof cardVisibility]})}
                      className="flex-1 flex items-center gap-3 cursor-pointer"
                    >
                      {cardVisibility[item.key as keyof typeof cardVisibility] ? <CheckCircle2 className="text-emerald-500 w-5 h-5"/> : <Circle className="text-slate-300 dark:text-slate-600 w-5 h-5"/>}
                      <div className={cardVisibility[item.key as keyof typeof cardVisibility] ? 'text-indigo-500' : ''}>
                        {item.icon}
                      </div>
                      <span className="text-xs font-bold">{item.label}</span>
                    </div>
                    <GripVertical className="text-slate-400 cursor-grab active:cursor-grabbing" />
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      
      {/* Main Stat Cards Layout */}
      <div className="grid grid-cols-2 gap-4">
        {cardOrder.map(key => {
          if (!cardVisibility[key as keyof typeof cardVisibility]) return null;
          
          if (key === 'tips' || key === 'offDays' || key === 'workDays') {
            return (
              <div key={key} className={key === 'tips' ? "col-span-2" : "col-span-1"}>
                {key === 'tips' && (
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
        )}
                {key === 'offDays' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className={`glass-panel p-6 rounded-[2rem] border-b-4 ${rangeData.leaveDays > 0 ? 'border-amber-400' : 'border-rose-500'} relative overflow-hidden group`}
          >
            <div className={`absolute -right-4 -top-4 w-24 h-24 ${rangeData.leaveDays > 0 ? 'bg-amber-400/5 group-hover:bg-amber-400/10' : 'bg-rose-500/5 group-hover:bg-rose-500/10'} rounded-full blur-2xl transition-colors`} />
            <div className="relative flex flex-col items-center text-center space-y-3">
              <div className={`p-3 ${rangeData.leaveDays > 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'} rounded-2xl`}>
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{workType === 'salary' ? 'วันหยุด/วันลาสะสม' : 'หยุดไปกี่วัน'}</p>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-1">
                  {rangeData.offDays + rangeData.leaveDays} <span className="text-sm font-bold text-slate-400 ml-1">วัน</span>
                </h3>
                {rangeData.leaveDays > 0 ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-bold bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                    {workType === 'salary' ? `(วันลาสะสม ${rangeData.leaveDays} วัน)` : `(ไม่ได้ขับ ${rangeData.offDays} / ลา ${rangeData.leaveDays})`}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1 font-bold">
                    {workType === 'salary' 
                      ? '(วันหยุดเสาร์-อาทิตย์/ไม่มีงานนอก)' 
                      : workType === 'freelance' 
                      ? '(ไม่มีงาน/ไม่มีรายจับ)' 
                      : `(รายได้ <= ฿${riderMinDaily})`}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
                {key === 'workDays' && (
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
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{workType === 'salary' ? 'วันทำงานปฏิบัติงาน' : 'ทำงานกี่วัน'}</p>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mt-1">
                  {rangeData.workDays} <span className="text-sm font-bold text-slate-400 ml-1">วัน</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 font-bold">
                  {workType === 'salary' 
                    ? '(วันทำงานปกติ/รับรายได้นอกเวลา)' 
                    : workType === 'freelance' 
                    ? '(มีรายรับจากโครงการจริง)' 
                    : `(รายได้ > ฿${riderMinDaily})`}
                </p>
              </div>
            </div>
          </motion.div>
        )}
              </div>
            );
          }

          if (key === 'secondaryStats') return <div key={key} className="col-span-2">
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
              {activeTab === 'monthly' && (
                <p className="text-xs font-bold text-slate-500 mt-1">คงเหลือ: ฿{rangeData.currentBalance.toLocaleString()}</p>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-rose-500" />
            </div>
          </div>
        </div>
      </div>;
          
          if (key === 'comparison') return <div key={key} className="col-span-2">
{ (activeTab === 'monthly' || activeTab === 'yearly') && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-5 rounded-3xl"
        >
          <div className="flex flex-col border-b border-slate-200 dark:border-slate-700/50 pb-4 mb-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5" />
              เทียบเงินคงเหลือในบัญชี กับเวลาเดียวกันของ{activeTab === 'monthly' ? 'เดือน' : 'ปี'}ที่แล้ว
            </p>
            
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 rounded-xl text-sm">
                <span className="text-slate-500 dark:text-slate-400">ยอดคงเหลือปัจจุบัน</span>
                <span className="font-bold text-slate-800 dark:text-white">฿{rangeData.currentBalance.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 rounded-xl text-sm">
                <span className="text-slate-500 dark:text-slate-400">ยอดคงเหลือเวลาเดียวกัน ({activeTab === 'monthly' ? 'เดือน' : 'ปี'}ที่แล้ว)</span>
                <span className="font-bold text-slate-800 dark:text-white">฿{rangeData.prevBalance.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center px-2 pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-600 dark:text-slate-300 text-sm font-bold">ส่วนต่าง</span>
                {(() => {
                  const currentNet = rangeData.currentBalance;
                  const prevNet = rangeData.prevBalance;
                  const diff = currentNet - prevNet;
                  const isPositive = diff > 0;
                  const prevNetAbs = Math.abs(prevNet);
                  const percent = prevNetAbs > 0 ? (diff / prevNetAbs) * 100 : 100;
                  if (diff === 0) return <span className="text-sm font-bold text-slate-400 mb-0.5">เท่าเดิม</span>;
                  return (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'}`}>
                      {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{isPositive ? '+' : ''}฿{Math.abs(diff).toLocaleString()}</span>
                      <span className="opacity-80 ml-0.5">({isPositive ? '+' : ''}{percent.toFixed(1)}%)</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          <div className="flex flex-col border-b border-slate-200 dark:border-slate-700/50 pb-4 mb-4 mt-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5" />
              เทียบรายรับรวมกับเวลาเดียวกันของ{activeTab === 'monthly' ? 'เดือน' : 'ปี'}ที่แล้ว
            </p>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 rounded-xl text-sm">
                <span className="text-slate-500 dark:text-slate-400">รายรับรวมปัจจุบัน</span>
                <span className="font-bold text-slate-800 dark:text-white">฿{rangeData.totalIncome.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 rounded-xl text-sm">
                <span className="text-slate-500 dark:text-slate-400">รายรับรวมเวลาเดียวกัน ({activeTab === 'monthly' ? 'เดือน' : 'ปี'}ที่แล้ว)</span>
                <span className="font-bold text-slate-800 dark:text-white">฿{Math.max(0, rangeData.prevTotalIncome).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center px-2 pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-600 dark:text-slate-300 text-sm font-bold">ส่วนต่าง</span>
                {(() => {
                  const diff = rangeData.totalIncome - rangeData.prevTotalIncome;
                  const isPositive = diff > 0;
                  const prevAbs = Math.abs(rangeData.prevTotalIncome);
                  const percent = prevAbs > 0 ? (diff / prevAbs) * 100 : 100;
                  if (diff === 0) return <span className="text-sm font-bold text-slate-400 mb-0.5">เท่าเดิม</span>;
                  return (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'}`}>
                      {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{isPositive ? '+' : ''}฿{Math.abs(diff).toLocaleString()}</span>
                      <span className="opacity-80 ml-0.5">({isPositive ? '+' : ''}{percent.toFixed(1)}%)</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          <div className="flex flex-col mt-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5" />
              เทียบรายจ่ายรวมกับเวลาเดียวกันของ{activeTab === 'monthly' ? 'เดือน' : 'ปี'}ที่แล้ว
            </p>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 rounded-xl text-sm">
                <span className="text-slate-500 dark:text-slate-400">รายจ่ายรวมปัจจุบัน</span>
                <span className="font-bold text-slate-800 dark:text-white">฿{rangeData.totalExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 rounded-xl text-sm">
                <span className="text-slate-500 dark:text-slate-400">รายจ่ายรวมเวลาเดียวกัน ({activeTab === 'monthly' ? 'เดือน' : 'ปี'}ที่แล้ว)</span>
                <span className="font-bold text-slate-800 dark:text-white">฿{rangeData.prevTotalExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center px-2 pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-600 dark:text-slate-300 text-sm font-bold">ส่วนต่าง</span>
                {(() => {
                  const diff = rangeData.totalExpenses - rangeData.prevTotalExpenses;
                  // For expenses, a DECREASE is actually positive (good), but visually we might use green for decrease.
                  const isBad = diff > 0;
                  const prevAbs = Math.abs(rangeData.prevTotalExpenses);
                  const percent = prevAbs > 0 ? (diff / prevAbs) * 100 : 100;
                  if (diff === 0) return <span className="text-sm font-bold text-slate-400 mb-0.5">เท่าเดิม</span>;
                  return (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${!isBad ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'}`}>
                      {!isBad ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                      <span>{!isBad ? '' : '+'}฿{Math.abs(diff).toLocaleString()}</span>
                      <span className="opacity-80 ml-0.5">({!isBad ? '' : '+'}{percent.toFixed(1)}%)</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </motion.div>
      )}
</div>;

          if (key === 'dailyChart') return <div key={key} className="col-span-2">
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
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                {workType === 'salary' ? 'เกณฑ์ปฏิบัติงานประจำ' : workType === 'freelance' ? 'เกณฑ์ฟรีแลนซ์' : `เป้าหมาย ฿${riderMinDaily}+`}
              </span>
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
                  {rangeData.dailyStatsList.map((entry, index) => {
                    const isWorked = (() => {
                      if (workType === 'salary') {
                        const dateObj = new Date(entry.date);
                        const dayOfWeek = dateObj.getDay();
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                        const isLeave = preferences?.leaveDays?.includes(entry.date);
                        if (isLeave) return false;
                        if (isWeekend) return entry.income > 0;
                        return true;
                      } else if (workType === 'freelance') {
                        return entry.income > 0 || (rangeData.activeFreelanceDates && rangeData.activeFreelanceDates.has(entry.date));
                      } else {
                        // rider
                        return entry.income > riderMinDaily;
                      }
                    })();
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isWorked ? '#10b981' : '#f43f5e'} 
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
                {workType === 'salary' ? 'วันปฏิบัติงาน' : workType === 'freelance' ? 'วันรับยอด' : `วันวิ่งงานจริง (>฿${riderMinDaily})`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f43f5e' }} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">
                {workType === 'salary' ? 'วันลา/เสาร์เสาร์อาทิตย์' : workType === 'freelance' ? 'วันว่างรับงาน' : `วันว่าง/ยอดไม่ถึง (<=฿${riderMinDaily})`}
              </span>
            </div>
          </div>
        </motion.div>
      )}
</div>;

          if (key === 'categoryChart') return <div key={key} className="col-span-2">
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
      
</div>;

          return null;
        })}
      </div>
      
      {/* Historical Overlap Line Chart */}
      { (activeTab === 'monthly' || activeTab === 'yearly') && rangeData.overlappingData?.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6 sm:p-8 rounded-[2rem] mt-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-widest">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                เปรียบเทียบย้อนหลังแยกราย{activeTab === 'monthly' ? 'เดือน' : 'ปี'} (Small Multiples)
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-bold">
                มาตราส่วนแกน Y เดียวกันทุกกราฟเพื่อให้เปรียบเทียบขนาดรายวันได้อย่างเที่ยงตรง
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {subplotPeriods.map((period) => {
              const total = subplotTotals[period.key];
              return (
                <div 
                  key={period.key} 
                  className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/30 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-200 dark:hover:border-slate-600/30 transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs font-black" style={{ color: period.color }}>
                        {period.label}
                      </p>
                      <p className="text-sm font-black text-slate-800 dark:text-white mt-1">
                        ฿{total.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="h-[140px] w-full mt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={rangeData.overlappingData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.4} />
                        <XAxis 
                          dataKey={activeTab === 'monthly' ? 'day' : 'month'} 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 'bold' }}
                          minTickGap={10}
                        />
                        <YAxis 
                          domain={[0, maxYValue]} 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 'bold' }} 
                          width={30}
                          tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '10px' }}
                          formatter={(value: number) => [`฿${value.toLocaleString()}`, 'รายได้']}
                          labelFormatter={(label) => activeTab === 'monthly' ? `วันที่ ${label}` : `เดือนที่ ${label}`}
                        />
                        <Line 
                          type="monotone" 
                          dataKey={period.key} 
                          stroke={period.color} 
                          strokeWidth={2.5} 
                          dot={{ r: 0 }} 
                          activeDot={{ r: 4, fill: period.color, stroke: '#fff', strokeWidth: 1.5 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
