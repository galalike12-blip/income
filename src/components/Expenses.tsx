import React, { useState, useMemo, useRef } from 'react';
import { JobEntry, ExpenseEntry, MonthlyBudget, UserPreferences } from '../types';
import { Plus, Trash2, Calendar, DollarSign, Wallet, PieChart, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Circle, Edit2, GripVertical, ChevronDown, ChevronUp, Settings2, Check, Lock, Unlock, BarChart2, AlertCircle, ChevronRight, Camera, Loader2 } from 'lucide-react';
import { Tooltip } from 'recharts';
import { motion, Reorder, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';
import { GoogleGenAI } from '@google/genai';

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

interface ExpensesProps {
  jobs: JobEntry[];
  expenses: ExpenseEntry[];
  addExpense: (expense: Omit<ExpenseEntry, 'id'>) => void;
  updateExpense: (id: string, updates: Partial<ExpenseEntry>) => void;
  deleteExpense: (id: string) => void;
  monthlyBudgets: MonthlyBudget[];
  setMonthlyBudget: (budget: MonthlyBudget) => void;
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  clearAllData: () => Promise<void>;
}

const getFaviconUrl = (url?: string) => {
  if (!url) return null;
  try {
    let validUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      validUrl = 'https://' + url;
    }
    const domain = new URL(validUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch (e) {
    return null;
  }
};

export function Expenses({ jobs, expenses, addExpense, updateExpense, deleteExpense, monthlyBudgets, setMonthlyBudget, preferences, updatePreferences, clearAllData }: ExpensesProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`);
  
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expensePayee, setExpensePayee] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [isFixed, setIsFixed] = useState(false);
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [necessity, setNecessity] = useState<'necessary' | 'luxury'>('necessary');
  const [durationMonths, setDurationMonths] = useState('1');
  const [websiteUrl, setWebsiteUrl] = useState('');
  
  const customCategories = preferences.customCategories || [];
  const setCustomCategories = (newCategories: string[]) => updatePreferences({ customCategories: newCategories });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [isCustomizingLayout, setIsCustomizingLayout] = useState(false);
  const widgetOrder = preferences.expensesWidgetOrder || ['summary', 'form', 'fixed', 'variable'];
  const setWidgetOrder = (newOrder: string[]) => updatePreferences({ expensesWidgetOrder: newOrder });
  const fixedExpensesOrder = preferences.fixedExpensesOrder || [];
  const setFixedExpensesOrder = (newOrder: string[]) => updatePreferences({ fixedExpensesOrder: newOrder });
  const [isFixedExpensesLocked, setIsFixedExpensesLocked] = useState(preferences.isFixedExpensesLocked ?? true);
  const [variableExpenseDateFilter, setVariableExpenseDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [showVariableHistory, setShowVariableHistory] = useState(false);

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseEntry | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!process.env.GEMINI_API_KEY) {
      toast.error("API Key is missing");
      return;
    }

    setIsScanning(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      const base64Content = base64Data.split(',')[1];

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        
        const prompt = `Extract expense details from this receipt image. 
        Return ONLY a JSON object with the following fields:
        - amount: number
        - category: string (one of: food, fuel, rent, utilities, shopping, maintenance, other)
        - payee: string (the store or person paid)
        - note: string (a brief description)
        
        If you cannot find a field, use an empty string or 0 for amount.
        Respond in JSON format only.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-preview',
          contents: {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Content,
                  mimeType: file.type
                }
              }
            ]
          },
          config: {
            responseMimeType: "application/json"
          }
        });

        const data = JSON.parse(response.text || '{}');

        if (data.amount) setExpenseAmount(data.amount.toString());
        if (data.category) setExpenseCategory(data.category);
        if (data.payee) setExpensePayee(data.payee);
        if (data.note) setExpenseNote(data.note);

        toast.success(t.synced || 'สแกนสำเร็จ');
      } catch (error) {
        console.error(error);
        toast.error(t.scanError2 || 'เกิดข้อผิดพลาดในการสแกนสลิป');
      } finally {
        setIsScanning(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEditClick = (expense: ExpenseEntry) => {
    setEditingExpenseId(expense.id);
    setExpenseAmount(expense.amount.toString());
    setExpenseCategory(expense.category);
    setExpensePayee(expense.payee || '');
    setExpenseNote(expense.note || '');
    setExpenseDate(expense.date);
    setNecessity(expense.necessity || 'necessary');
    setWebsiteUrl(expense.websiteUrl || '');
    setIsFixed(expense.isFixed || false);
    setFrequency(expense.frequency || 'monthly');
    setIsIndefinite(expense.isIndefinite || false);
    setDurationMonths(expense.durationMonths?.toString() || '1');
    
    // Scroll to form
    const formElement = document.getElementById('expense-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const cancelEdit = () => {
    setEditingExpenseId(null);
    setExpenseAmount('');
    setExpenseCategory('');
    setExpensePayee('');
    setExpenseNote('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setIsFixed(false);
    setFrequency('monthly');
    setIsIndefinite(false);
    setDurationMonths('1');
    setWebsiteUrl('');
  };


  const handleDeleteExpense = (expense: ExpenseEntry) => {
    if (expense.groupId) {
      setExpenseToDelete(expense);
    } else {
      deleteExpense(expense.id);
    }
  };

  const confirmDeleteGroup = (mode: 'onwards' | 'all') => {
    if (!expenseToDelete || !expenseToDelete.groupId) return;
    
    const groupExpenses = expenses.filter(e => e.groupId === expenseToDelete.groupId);
    
    if (mode === 'all') {
      groupExpenses.forEach(e => deleteExpense(e.id));
    } else if (mode === 'onwards') {
      const targetDate = new Date(expenseToDelete.date);
      groupExpenses.forEach(e => {
        if (new Date(e.date) >= targetDate) {
          deleteExpense(e.id);
        }
      });
    }
    
    setExpenseToDelete(null);
  };

  const confirmDeleteSingle = () => {
    if (!expenseToDelete) return;
    deleteExpense(expenseToDelete.id);
    setExpenseToDelete(null);
  };

  const currentBudget = monthlyBudgets.find(b => b.month === selectedMonth)?.amount || 0;
  const [budgetInput, setBudgetInput] = useState(currentBudget.toString());
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState('');

  // Calculate carry over from previous month
  const carryOverBalance = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    const prevBudget = monthlyBudgets.find(b => b.month === prevMonthStr)?.amount || 0;
    const prevMonthJobs = jobs.filter(j => j.date.startsWith(prevMonthStr));
    const prevMonthExpenses = expenses.filter(e => e.date.startsWith(prevMonthStr));
    
    const prevIncome = prevMonthJobs.reduce((sum, j) => sum + (j.actualReceived || 0), 0);
    const prevExpenseTotal = prevMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    // If we have a budget for the previous month, we can calculate the carry over
    // If not, we assume 0 or the user starts fresh
    return (prevBudget + prevIncome) - prevExpenseTotal;
  }, [selectedMonth, monthlyBudgets, jobs, expenses]);

  const effectiveBudget = currentBudget > 0 ? currentBudget : (carryOverBalance > 0 ? carryOverBalance : 0);

  const monthExpenses = useMemo(() => {
    return expenses.filter(e => e.date.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  const fixedExpenses = useMemo(() => {
    const fixed = monthExpenses.filter(e => e.isFixed);
    return fixed.sort((a, b) => {
      const keyA = a.payee || a.category;
      const keyB = b.payee || b.category;
      const indexA = fixedExpensesOrder.indexOf(keyA);
      const indexB = fixedExpensesOrder.indexOf(keyB);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [monthExpenses, fixedExpensesOrder]);

  const variableExpenses = monthExpenses.filter(e => !e.isFixed);

  const groupedVariableHistory = useMemo(() => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const filtered = expenses.filter(e => !e.isFixed && new Date(e.date) >= oneYearAgo);
    const groups: Record<string, ExpenseEntry[]> = {};
    
    filtered.forEach(exp => {
      if (!groups[exp.date]) groups[exp.date] = [];
      groups[exp.date].push(exp);
    });
    
    return Object.entries(groups)
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([date, items]) => ({ date, items }));
  }, [expenses]);

  const totalFixed = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalVariable = variableExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = totalFixed + totalVariable;
  const remainingBudget = effectiveBudget - totalExpenses;

  const handleResetData = async () => {
    if (resetInput === 'RESET') {
      try {
        await clearAllData();
        setResetInput('');
        setShowResetConfirm(false);
        toast.success(t.resetSuccess || 'ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว');
      } catch (error) {
        toast.error('Error resetting data');
      }
    }
  };

  const totalNecessary = monthExpenses.filter(e => e.necessity !== 'luxury').reduce((sum, e) => sum + e.amount, 0);
  const totalLuxury = monthExpenses.filter(e => e.necessity === 'luxury').reduce((sum, e) => sum + e.amount, 0);

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'food': return t.food || 'ค่าอาหาร/เครื่องดื่ม';
      case 'fuel': return t.fuel || 'ค่าน้ำมัน/เดินทาง';
      case 'rent': return t.rent || 'ค่าเช่า/ที่พัก';
      case 'utilities': return t.utilities || 'ค่าน้ำ/ค่าไฟ/เน็ต';
      case 'shopping': return t.shopping || 'ช็อปปิ้ง/ของใช้ส่วนตัว';
      case 'maintenance': return t.maintenance || 'ค่าซ่อมบำรุง';
      case 'other': return t.other || 'อื่นๆ';
      default: return category;
    }
  };

  const expensePieData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    monthExpenses.forEach(exp => {
      const cat = exp.category;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
    });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses]);

  const getGroupProgress = (groupId?: string) => {
    if (!groupId) return null;
    const groupExpenses = expenses.filter(e => e.groupId === groupId);
    if (groupExpenses.length <= 1) return null;
    
    // If any expense in the group is indefinite, we don't show progress
    if (groupExpenses.some(e => e.isIndefinite)) return null;
    
    const paidCount = groupExpenses.filter(e => e.isPaid).length;
    const totalCount = groupExpenses.length;
    return { paidCount, remainingCount: totalCount - paidCount, totalCount };
  };

  const last7DaysExpensesData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayExpenses = expenses.filter(e => e.date === dateStr);
      
      const totalAmount = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
      
      data.push({
        date: d.toLocaleDateString(currentLang === 'th' ? 'th-TH' : currentLang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short', day: 'numeric' }),
        amount: totalAmount
      });
    }
    return data;
  }, [expenses, currentLang]);

  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(budgetInput);
    if (!isNaN(amount)) {
      setMonthlyBudget({ month: selectedMonth, amount });
    }
    setIsEditingBudget(false);
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expenseAmount);
    if (amount > 0) {
      let duration = 1;
      if (isFixed) {
        if (isIndefinite) {
          duration = frequency === 'yearly' ? 10 : 120;
        } else {
          duration = parseInt(durationMonths) || 1;
        }
      }

      if (editingExpenseId) {
        const originalExpense = expenses.find(ex => ex.id === editingExpenseId);
        if (!originalExpense) return;

        if (originalExpense.groupId) {
          // It WAS a group
          const groupExpenses = expenses.filter(ex => ex.groupId === originalExpense.groupId);
          groupExpenses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          const currentIndex = groupExpenses.findIndex(ex => ex.id === originalExpense.id);
          
          if (isFixed && duration > 1) {
            // Keep it as a group, update existing, add/remove as needed
            for (let i = 0; i < duration; i++) {
              const offset = i - currentIndex;
              const newDate = new Date(expenseDate);
              if (frequency === 'yearly') {
                newDate.setFullYear(newDate.getFullYear() + offset);
              } else {
                newDate.setMonth(newDate.getMonth() + offset);
              }
              const formattedDate = newDate.toISOString().split('T')[0];
              
              if (i < groupExpenses.length) {
                // Update existing
                updateExpense(groupExpenses[i].id, {
                  amount,
                  category: expenseCategory,
                  payee: expensePayee,
                  note: expenseNote,
                  date: formattedDate,
                  necessity,
                  websiteUrl: websiteUrl.trim() || undefined,
                  isFixed: true,
                  frequency,
                  isIndefinite,
                  durationMonths: isIndefinite ? undefined : duration,
                });
              } else {
                // Add new ones to the group
                addExpense({
                  amount,
                  category: expenseCategory,
                  payee: expensePayee,
                  note: expenseNote,
                  date: formattedDate,
                  necessity,
                  websiteUrl: websiteUrl.trim() || undefined,
                  isFixed: true,
                  frequency,
                  isIndefinite,
                  durationMonths: isIndefinite ? undefined : duration,
                  isPaid: false,
                  groupId: originalExpense.groupId
                });
              }
            }
            // Remove extra ones if duration decreased
            if (groupExpenses.length > duration) {
              for (let i = duration; i < groupExpenses.length; i++) {
                deleteExpense(groupExpenses[i].id);
              }
            }
          } else {
            // Changed from group to single
            groupExpenses.forEach(ex => {
              if (ex.id === originalExpense.id) {
                updateExpense(ex.id, {
                  amount,
                  category: expenseCategory,
                  payee: expensePayee,
                  note: expenseNote,
                  date: expenseDate,
                  necessity,
                  websiteUrl: websiteUrl.trim() || undefined,
                  isFixed,
                  frequency,
                  isIndefinite,
                  durationMonths: 1,
                  groupId: undefined
                });
              } else {
                deleteExpense(ex.id);
              }
            });
          }
        } else {
          // It WAS single
          if (isFixed && duration > 1) {
            // Changed from single to group
            const newGroupId = Date.now().toString();
            for (let i = 0; i < duration; i++) {
              const d = new Date(expenseDate);
              if (frequency === 'yearly') {
                d.setFullYear(d.getFullYear() + i);
              } else {
                d.setMonth(d.getMonth() + i);
              }
              const formattedDate = d.toISOString().split('T')[0];
              
              if (i === 0) {
                updateExpense(originalExpense.id, {
                  amount,
                  category: expenseCategory,
                  payee: expensePayee,
                  note: expenseNote,
                  date: formattedDate,
                  necessity,
                  websiteUrl: websiteUrl.trim() || undefined,
                  isFixed: true,
                  frequency,
                  isIndefinite,
                  durationMonths: isIndefinite ? undefined : duration,
                  groupId: newGroupId
                });
              } else {
                addExpense({
                  amount,
                  category: expenseCategory,
                  payee: expensePayee,
                  note: expenseNote,
                  date: formattedDate,
                  necessity,
                  websiteUrl: websiteUrl.trim() || undefined,
                  isFixed: true,
                  frequency,
                  isIndefinite,
                  durationMonths: isIndefinite ? undefined : duration,
                  isPaid: false,
                  groupId: newGroupId
                });
              }
            }
          } else {
            // Still single
            updateExpense(originalExpense.id, {
              amount,
              category: expenseCategory,
              payee: expensePayee,
              note: expenseNote,
              date: expenseDate,
              necessity,
              websiteUrl: websiteUrl.trim() || undefined,
              isFixed,
              frequency,
              isIndefinite,
              durationMonths: 1,
              groupId: undefined
            });
          }
        }
        setEditingExpenseId(null);
      } else {
        // ADD NEW logic
        const groupId = duration > 1 ? Date.now().toString() : undefined;
        
        for (let i = 0; i < duration; i++) {
          const d = new Date(expenseDate);
          if (frequency === 'yearly') {
            d.setFullYear(d.getFullYear() + i);
          } else {
            d.setMonth(d.getMonth() + i);
          }
          const formattedDate = d.toISOString().split('T')[0];
          
          addExpense({
            date: formattedDate,
            amount,
            category: expenseCategory,
            payee: expensePayee,
            note: expenseNote,
            isFixed,
            frequency,
            isIndefinite,
            necessity,
            durationMonths: isIndefinite ? undefined : duration,
            websiteUrl: websiteUrl.trim() || undefined,
            isPaid: false,
            groupId
          });
        }
      }
      
      // Save custom category if it's not in the default list and not already in customCategories
      const defaultCategories = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Shopping', 'Health', 'Housing', 'Other'];
      if (expenseCategory && !defaultCategories.includes(expenseCategory) && !customCategories.includes(expenseCategory)) {
        setCustomCategories([...customCategories, expenseCategory]);
      }
      
      setExpenseAmount('');
      setExpensePayee('');
      setExpenseNote('');
      setWebsiteUrl('');
      setDurationMonths('1');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header & Month Picker */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.expenseManagement || 'ระบบจัดการรายจ่าย'}</h1>
          <p className="text-slate-500 dark:text-slate-400">Fixed Cost Pro</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsCustomizingLayout(!isCustomizingLayout)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
              isCustomizingLayout 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20' 
                : 'bg-white/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800/80 border border-white/40 dark:border-slate-700/50'
            }`}
          >
            {isCustomizingLayout ? (
              <>
                <Check className="w-4 h-4" />
                {t.doneCustomizing || 'เสร็จสิ้น'}
              </>
            ) : (
              <>
                <Settings2 className="w-4 h-4" />
                {t.customizeLayout || 'ปรับแต่งหน้าจอ'}
              </>
            )}
          </button>
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="flex-1 sm:flex-none px-4 py-2 glass-input rounded-xl font-medium"
          />
        </div>
      </div>

      {isCustomizingLayout ? (
        <Reorder.Group axis="y" values={widgetOrder} onReorder={setWidgetOrder} className="space-y-4">
          {widgetOrder.map(id => (
            <Reorder.Item key={id} value={id} className="glass-panel p-4 rounded-3xl flex items-center gap-4 cursor-grab active:cursor-grabbing">
              <GripVertical className="text-slate-400" />
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {id === 'summary' && (t.budgetSummary || 'สรุปงบประมาณ')}
                {id === 'form' && (t.addExpense || 'เพิ่มรายจ่ายใหม่')}
                {id === 'fixed' && (t.fixedCosts || 'รายจ่ายคงที่ (Fixed Costs)')}
                {id === 'variable' && (t.variableCosts || 'รายจ่ายผันแปร (Variable Costs)')}
              </span>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <div className="space-y-6">
          {widgetOrder.map(id => (
            <div key={id}>
              {id === 'summary' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet className="w-16 h-16 text-emerald-500" />
          </div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
            {currentBudget > 0 ? (t.startingBudget || 'เงินตั้งต้นเดือนนี้') : (t.carryOverFromLastMonth || 'ยอดยกมาจากเดือนที่แล้ว')}
          </h3>
          {isEditingBudget ? (
            <form onSubmit={handleBudgetSubmit} className="flex gap-2 mt-2">
              <input
                type="number"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                className="w-full px-3 py-1 glass-input rounded-lg"
                autoFocus
                onBlur={handleBudgetSubmit}
              />
            </form>
          ) : (
            <div 
              className={`text-3xl font-bold ${currentBudget > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => {
                setBudgetInput(currentBudget.toString());
                setIsEditingBudget(true);
              }}
            >
              ฿{effectiveBudget.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {currentBudget === 0 && effectiveBudget > 0 && (
                <span className="text-xs font-normal ml-2 opacity-60 italic">({t.carryOver || 'ยกมา'})</span>
              )}
            </div>
          )}
        </div>

        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ArrowDownCircle className="w-16 h-16 text-rose-500" />
          </div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t.totalExpensesThisMonth || 'รายจ่ายรวมเดือนนี้'}</h3>
          <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">
            ฿{totalExpenses.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-slate-500">{t.fixed || 'คงที่'}: ฿{totalFixed.toLocaleString()}</span>
            <span className="text-slate-500">{t.variable || 'ผันแปร'}: ฿{totalVariable.toLocaleString()}</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <PieChart className="w-16 h-16 text-indigo-500" />
          </div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t.remainingBudget || 'ยอดคงเหลือ'}</h3>
          <div className={`text-3xl font-bold ${remainingBudget >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
            ฿{remainingBudget.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

              )}
              {id === 'form' && (
                <div id="expense-form" className={`glass-panel p-6 sm:p-8 rounded-3xl space-y-6 transition-all ${editingExpenseId ? 'ring-2 ring-indigo-400/50 dark:ring-indigo-500/50' : ''}`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {editingExpenseId ? <Edit2 className="w-5 h-5 text-indigo-500" /> : <Plus className="w-5 h-5 text-indigo-500" />}
            {editingExpenseId ? (t.editExpense || 'แก้ไขรายจ่าย') : (t.addExpense || 'เพิ่มรายจ่ายใหม่')}
          </h2>
          
          <div className="flex items-center gap-2">
            {!editingExpenseId && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleScanReceipt}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all text-sm font-medium border border-indigo-100 dark:border-indigo-800/50"
                >
                  {isScanning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  {isScanning ? (t.scanning || 'กำลังสแกน...') : (t.scanReceipt || 'สแกนสลิป')}
                </button>
              </>
            )}
            {editingExpenseId && (
              <span className="text-xs font-medium px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full">
                {t.edit || 'แก้ไข'} Mode
              </span>
            )}
          </div>
        </div>
        
        <form onSubmit={handleExpenseSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.date || 'วันที่'}</label>
            <input 
              type="date" 
              value={expenseDate} 
              onChange={e => setExpenseDate(e.target.value)} 
              className="w-full px-4 py-3 glass-input rounded-2xl"
              required
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.category || 'หมวดหมู่'}</label>
            {isAddingCategory ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder={t.newCategoryPlaceholder || 'ชื่อหมวดหมู่ใหม่'}
                  className="w-full px-4 py-3 glass-input rounded-2xl"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newCategoryName.trim()) {
                      if (!customCategories.includes(newCategoryName.trim())) {
                        setCustomCategories([...customCategories, newCategoryName.trim()]);
                      }
                      setExpenseCategory(newCategoryName.trim());
                    }
                    setIsAddingCategory(false);
                  }}
                  className="px-4 py-3 bg-indigo-600 text-white rounded-2xl whitespace-nowrap"
                >
                  {t.add || 'เพิ่ม'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCategory(false);
                    setExpenseCategory('');
                  }}
                  className="px-4 py-3 bg-slate-200 text-slate-700 rounded-2xl whitespace-nowrap"
                >
                  {t.cancel || 'ยกเลิก'}
                </button>
              </div>
            ) : (
              <div className="relative">
                <select 
                  value={expenseCategory} 
                  onChange={e => {
                    if (e.target.value === 'ADD_NEW') {
                      setIsAddingCategory(true);
                      setNewCategoryName('');
                    } else if (e.target.value === 'MANAGE') {
                      setIsManagingCategories(true);
                      setExpenseCategory('');
                    } else {
                      setExpenseCategory(e.target.value);
                    }
                  }}
                  className="w-full px-4 py-3 glass-input rounded-2xl appearance-none pr-10"
                  required
                >
                  <option value="" disabled className="text-slate-500">{t.selectCategory || 'เลือกหมวดหมู่'}</option>
                  {customCategories.map(cat => (
                    <option key={cat} value={cat} className="text-slate-900">{cat}</option>
                  ))}
                  <option value="ADD_NEW" className="text-indigo-600 font-medium">+ {t.addNewCategory || 'เพิ่มหมวดหมู่ใหม่'}</option>
                  {customCategories.length > 0 && (
                    <option value="MANAGE" className="text-slate-600 font-medium">⚙️ {t.manageCategories || 'จัดการหมวดหมู่'}</option>
                  )}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
            )}
          </div>
          <div className="sm:col-span-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.payee || 'ชื่อปลายทาง/ผู้รับโอน'}</label>
            <input 
              type="text" 
              value={expensePayee} 
              onChange={e => setExpensePayee(e.target.value)} 
              placeholder={t.payeePlaceholder || "ชื่อปลายทาง/ผู้รับโอน"} 
              className="w-full px-4 py-3 glass-input rounded-2xl"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.amount || 'จำนวนเงิน'}</label>
            <input 
              type="number" 
              step="0.01" 
              value={expenseAmount} 
              onChange={e => setExpenseAmount(e.target.value)} 
              placeholder={t.amountPlaceholder || "จำนวนเงิน"} 
              className="w-full px-4 py-3 glass-input rounded-2xl"
              required
            />
          </div>
          <div className="sm:col-span-12">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.note || 'หมายเหตุ (ถ้ามี)'}</label>
            <input 
              type="text" 
              value={expenseNote} 
              onChange={e => setExpenseNote(e.target.value)} 
              placeholder={t.notePlaceholder || "หมายเหตุ (ถ้ามี)"} 
              className="w-full px-4 py-3 glass-input rounded-2xl"
            />
          </div>
          <div className="sm:col-span-12 flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input 
                  type="checkbox" 
                  checked={isFixed}
                  onChange={e => setIsFixed(e.target.checked)}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300">{t.isFixedCost || 'เป็นรายจ่ายคงที่ (Fixed Cost)'}</span>
              </label>
              {isFixed && (
                <div className="flex flex-wrap items-center gap-4 pl-7">
                  <div className="relative">
                    <select
                      value={frequency}
                      onChange={e => setFrequency(e.target.value as 'monthly' | 'yearly')}
                      className="px-3 py-2 glass-input rounded-xl text-sm appearance-none pr-9"
                    >
                      <option value="monthly">{t.monthly || 'รายเดือน'}</option>
                      <option value="yearly">{t.yearly || 'รายปี'}</option>
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isIndefinite}
                      onChange={e => setIsIndefinite(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400">{t.indefinite || 'ไม่มีกำหนด'}</span>
                  </label>

                  {!isIndefinite && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">{t.durationMonths || 'จำนวนงวด'}:</span>
                      <input 
                        type="number" 
                        min="1"
                        value={durationMonths} 
                        onChange={e => setDurationMonths(e.target.value)} 
                        className="w-20 px-3 py-2 glass-input rounded-xl text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{t.necessity || 'ความจำเป็น'}</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="necessity"
                      value="necessary"
                      checked={necessity === 'necessary'}
                      onChange={() => setNecessity('necessary')}
                      className="w-5 h-5 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 transition-colors">{t.necessary || 'รายจ่ายจำเป็น'}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="necessity"
                      value="luxury"
                      checked={necessity === 'luxury'}
                      onChange={() => setNecessity('luxury')}
                      className="w-5 h-5 text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-rose-600 transition-colors">{t.luxury || 'รายจ่ายฟุ่มเฟือย'}</span>
                  </label>
                </div>
              </div>

              <div className="sm:col-span-8">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.websiteUrl || 'ลิงก์เว็บไซต์ (เพื่อแสดงไอคอน)'}</label>
                <input 
                  type="url" 
                  value={websiteUrl} 
                  onChange={e => setWebsiteUrl(e.target.value)} 
                  placeholder={t.websitePlaceholder || "https://example.com"} 
                  className="w-full px-4 py-3 glass-input rounded-2xl text-sm"
                />
              </div>
            </div>
          </div>
          <div className="sm:col-span-12 flex justify-end items-center gap-3 mt-4">
            {editingExpenseId && (
              <button 
                type="button"
                onClick={cancelEdit}
                className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                {t.cancel || 'ยกเลิก'}
              </button>
            )}
            <button 
              type="submit" 
              disabled={!expenseAmount}
              className="px-6 py-3 glass-button rounded-2xl font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {editingExpenseId ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {editingExpenseId ? (t.updateExpense || 'อัปเดตรายจ่าย') : (t.saveExpense || 'บันทึกรายจ่าย')}
            </button>
          </div>
        </form>
      </div>

              )}
              {id === 'fixed' && (
                <div className="glass-panel p-6 rounded-3xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              {t.fixedCosts || 'รายจ่ายคงที่ (Fixed Costs)'}
            </h3>
            <button
              onClick={() => setIsFixedExpensesLocked(!isFixedExpensesLocked)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title={isFixedExpensesLocked ? "ปลดล็อคเพื่อจัดเรียง" : "ล็อคตำแหน่ง"}
            >
              {isFixedExpensesLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </button>
          </div>
          {fixedExpenses.length === 0 ? (
            <p className="text-center text-slate-500 py-4">{t.noFixedExpenses || 'ไม่มีรายจ่ายคงที่ในเดือนนี้'}</p>
          ) : (
            <Reorder.Group 
              axis="y" 
              values={fixedExpenses} 
              onReorder={(newOrder) => setFixedExpensesOrder(newOrder.map(e => e.payee || e.category))} 
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {fixedExpenses.map(expense => (
                <Reorder.Item 
                  key={expense.id} 
                  value={expense} 
                  dragListener={!isFixedExpensesLocked}
                  className={`relative ${isFixedExpensesLocked ? '' : 'cursor-grab active:cursor-grabbing'}`}
                >
                  <div className="h-full">
                    <ExpenseItem
                      expense={expense}
                      updateExpense={updateExpense}
                      handleEditClick={handleEditClick}
                      handleDeleteExpense={handleDeleteExpense}
                      getFaviconUrl={getFaviconUrl}
                      t={t}
                      isFixed={true}
                      progress={getGroupProgress(expense.groupId)}
                      showDragHandle={!isFixedExpensesLocked}
                    />
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}
        </div>

              )}
              {id === 'variable' && (
                <div className="glass-panel p-6 rounded-3xl">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                    <div className="flex items-center justify-between w-full sm:w-auto">
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        {showVariableHistory ? t.history : t.variableCosts || 'รายจ่ายผันแปร (Variable Costs)'}
                      </h3>
                      <button 
                        onClick={() => setShowVariableHistory(!showVariableHistory)}
                        className="sm:hidden text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {showVariableHistory ? t.today : t.history}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setShowVariableHistory(!showVariableHistory)}
                        className="hidden sm:block text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mr-2"
                      >
                        {showVariableHistory ? t.today : t.history}
                      </button>
                      {!showVariableHistory && (
                        <input 
                          type="date" 
                          value={variableExpenseDateFilter}
                          onChange={(e) => setVariableExpenseDateFilter(e.target.value)}
                          className="px-3 py-1.5 glass-input rounded-xl text-sm w-full sm:w-auto"
                        />
                      )}
                    </div>
                  </div>

                  {!showVariableHistory ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {variableExpenses.filter(e => e.date === variableExpenseDateFilter).length === 0 ? (
                        <div className="sm:col-span-2">
                          <p className="text-center text-slate-500 py-8 glass-panel rounded-2xl border-dashed border-2 border-slate-200 dark:border-slate-700">{t.noVariableExpenses || 'ไม่มีรายจ่ายผันแปรในวันที่เลือก'}</p>
                        </div>
                      ) : (
                        variableExpenses.filter(e => e.date === variableExpenseDateFilter).map(expense => (
                          <ExpenseItem
                            key={expense.id}
                            expense={expense}
                            updateExpense={updateExpense}
                            handleEditClick={handleEditClick}
                            handleDeleteExpense={handleDeleteExpense}
                            getFaviconUrl={getFaviconUrl}
                            t={t}
                            isFixed={false}
                          />
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {groupedVariableHistory.length === 0 ? (
                        <div className="glass-panel-subtle border-dashed rounded-3xl p-10 text-center text-slate-500 dark:text-slate-400 transition-colors">
                          {t.noDataForRange}
                        </div>
                      ) : (
                        groupedVariableHistory.map((group) => (
                          <div key={group.date} className="space-y-3">
                            <div className="flex items-center gap-2 px-2">
                              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                {new Date(group.date).toLocaleDateString(currentLang === 'th' ? 'th-TH' : currentLang === 'zh' ? 'zh-CN' : 'en-US', { 
                                  day: 'numeric', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })}
                              </span>
                              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {group.items.map((expense) => (
                                <ExpenseItem
                                  key={expense.id}
                                  expense={expense}
                                  updateExpense={updateExpense}
                                  handleEditClick={handleEditClick}
                                  handleDeleteExpense={handleDeleteExpense}
                                  getFaviconUrl={getFaviconUrl}
                                  t={t}
                                  isFixed={false}
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

      {/* Reset Data Section */}
      <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-center">
        <button
          onClick={() => setShowResetConfirm(true)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-2xl text-sm font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-all border border-rose-100 dark:border-rose-900/30"
        >
          <Trash2 className="w-4 h-4" />
          {t.resetData || 'ล้างข้อมูลทั้งหมด'}
        </button>
      </div>

      {/* Manage Categories Modal */}
      {isManagingCategories && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
              {t.manageCategories || 'จัดการหมวดหมู่'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{t.dragToReorder || 'ลากเพื่อจัดลำดับหมวดหมู่'}</p>
            
            <div className="mb-6">
              {customCategories.length === 0 ? (
                <p className="text-slate-500 text-center py-4">{t.noCustomCategories || 'ไม่มีหมวดหมู่ที่เพิ่มเอง'}</p>
              ) : (
                <Reorder.Group 
                  axis="y" 
                  values={customCategories} 
                  onReorder={setCustomCategories}
                  className="space-y-2 max-h-[60vh] overflow-y-auto pr-2"
                >
                  {customCategories.map(cat => (
                    <Reorder.Item 
                      key={cat} 
                      value={cat}
                      className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-transparent active:border-indigo-500/50 active:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-slate-400 cursor-grab active:cursor-grabbing" />
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{cat}</span>
                      </div>
                      <button 
                        onClick={() => {
                          const expensesInCategory = expenses.filter(e => e.category === cat);
                          if (expensesInCategory.length > 0) {
                            toast.error(`ไม่สามารถลบหมวดหมู่ "${cat}" ได้ เพราะยังมีรายการค่าใช้จ่ายที่ใช้หมวดหมู่นี้อยู่`);
                          } else {
                            setCustomCategories(customCategories.filter(c => c !== cat));
                            if (expenseCategory === cat) {
                              setExpenseCategory('');
                            }
                          }
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={() => setIsManagingCategories(false)}
                className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                {t.close || 'ปิด'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Delete Group Modal */}
      <AnimatePresence>
        {expenseToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-rose-500 mb-2">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold">{t.confirmDelete || 'ยืนยันการลบ'}</h3>
              </div>
              
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                {t.deleteGroupPrompt || 'รายจ่ายนี้เป็นรายจ่ายคงที่แบบหลายเดือน คุณต้องการลบเฉพาะเดือนนี้ หรือลบทั้งหมดในกลุ่มนี้?'}
              </p>

              <div className="space-y-2 pt-2">
                <button
                  onClick={confirmDeleteSingle}
                  className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-between"
                >
                  <span>{t.deleteOnlyThisMonth || 'ลบเฉพาะเดือนนี้'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => confirmDeleteGroup('onwards')}
                  className="w-full py-3 px-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors flex items-center justify-between"
                >
                  <span>{t.deleteFromThisMonthOnwards || 'ลบตั้งแต่เดือนนี้เป็นต้นไป'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => confirmDeleteGroup('all')}
                  className="w-full py-3 px-4 bg-rose-600 text-white rounded-2xl text-sm font-medium hover:bg-rose-700 transition-colors flex items-center justify-between"
                >
                  <span>{t.deleteAllOccurrences || 'ลบทุกรายการ (รวมอดีต)'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setExpenseToDelete(null)}
                className="w-full py-3 text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                {t.cancel || 'ยกเลิก'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Data Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-rose-500 mb-2">
                <Trash2 className="w-6 h-6" />
                <h3 className="text-lg font-bold">{t.resetData || 'ล้างข้อมูลทั้งหมด'}</h3>
              </div>
              
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                {t.resetConfirmPrompt || "พิมพ์ 'RESET' เพื่อยืนยันว่าคุณต้องการลบข้อมูลทั้งหมด (การกระทำนี้ไม่สามารถย้อนกลับได้)"}
              </p>

              <input
                type="text"
                value={resetInput}
                onChange={e => setResetInput(e.target.value)}
                placeholder={t.resetPlaceholder || "พิมพ์ RESET ที่นี่"}
                className="w-full px-4 py-3 glass-input rounded-2xl text-center font-bold tracking-widest"
              />

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowResetConfirm(false);
                    setResetInput('');
                  }}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-sm font-medium"
                >
                  {t.cancel || 'ยกเลิก'}
                </button>
                <button
                  onClick={handleResetData}
                  disabled={resetInput !== 'RESET'}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-2xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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

function ExpenseItem({ expense, updateExpense, handleEditClick, handleDeleteExpense, getFaviconUrl, t, isFixed, progress, showDragHandle }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden h-full flex flex-col ${
        expense.isPaid 
          ? 'bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/30 shadow-sm' 
          : 'bg-white/60 dark:bg-slate-800/60 border-white/40 dark:border-slate-700/50 shadow-md hover:shadow-lg'
      }`}
    >
      <div 
        className="flex flex-col p-4 cursor-pointer hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors flex-1"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {showDragHandle && (
              <div className="flex-shrink-0 text-slate-400 cursor-grab active:cursor-grabbing">
                <GripVertical className="w-5 h-5" />
              </div>
            )}
            {isFixed && (
              <button 
                onClick={(e) => { e.stopPropagation(); updateExpense(expense.id, { isPaid: !expense.isPaid }); }}
                className="flex-shrink-0 focus:outline-none"
              >
                {expense.isPaid ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : (
                  <Circle className="w-6 h-6 text-slate-300 dark:text-slate-600 hover:text-indigo-400 transition-colors" />
                )}
              </button>
            )}
            <div className="flex items-center gap-2">
              {getFaviconUrl(expense.websiteUrl) ? (
                <img src={getFaviconUrl(expense.websiteUrl)!} alt="icon" className={`w-8 h-8 rounded-full bg-white p-1 flex-shrink-0 ${expense.isPaid ? 'opacity-70' : ''}`} referrerPolicy="no-referrer" />
              ) : (
                <div className={`w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 ${expense.isPaid ? 'opacity-70' : ''}`}>
                </div>
              )}
              <div className={`text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${expense.isPaid ? 'opacity-70' : ''}`}>
                {expense.category === 'food' ? t.food || 'Food' : 
                 expense.category === 'fuel' ? t.fuel || 'Fuel' : 
                 expense.category === 'rent' ? t.rent || 'Rent' : 
                 expense.category === 'utilities' ? t.utilities || 'Utilities' : 
                 expense.category === 'shopping' ? t.shopping || 'Shopping' : 
                 expense.category === 'maintenance' ? t.maintenance || 'Maintenance' : 
                 expense.category === 'other' ? t.other || 'Other' : expense.category}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
        </div>

        <div className={`flex flex-col gap-1 mb-2 ${expense.isPaid ? 'opacity-70' : ''}`}>
          <div className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
            {expense.payee || (expense.category === 'food' ? t.food || 'Food' : 
                 expense.category === 'fuel' ? t.fuel || 'Fuel' : 
                 expense.category === 'rent' ? t.rent || 'Rent' : 
                 expense.category === 'utilities' ? t.utilities || 'Utilities' : 
                 expense.category === 'shopping' ? t.shopping || 'Shopping' : 
                 expense.category === 'maintenance' ? t.maintenance || 'Maintenance' : 
                 expense.category === 'other' ? t.other || 'Other' : expense.category)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xl font-black ${expense.isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              ฿{expense.amount.toLocaleString()}
            </span>
            {expense.necessity === 'luxury' && (
              <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-full font-bold uppercase tracking-tighter">
                {t.luxury || 'Luxury'}
              </span>
            )}
            {expense.isIndefinite && (
              <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-full font-bold uppercase tracking-tighter">
                {t.indefinite || 'Indefinite'}
              </span>
            )}
            {expense.isPaid && (
              <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full font-bold uppercase tracking-tighter">
                {t.paid || 'Paid'}
              </span>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-slate-50/80 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-1 gap-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 font-medium">{t.date || 'Date'}</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">{expense.date}</span>
            </div>
            {expense.payee && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 font-medium">{t.payee || 'Payee'}</span>
                <span className="text-slate-700 dark:text-slate-200 font-semibold truncate ml-4">{expense.payee}</span>
              </div>
            )}
            {expense.note && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400 font-medium">{t.note || 'Note'}</span>
                <span className="text-slate-600 dark:text-slate-300 italic bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                  {expense.note}
                </span>
              </div>
            )}
            {isFixed && progress && (
              <div className="p-2 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100/50 dark:border-indigo-800/30">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                  <span>{t.paymentProgress || 'Payment Progress'}</span>
                  <span>{Math.round((progress.paidCount / (progress.paidCount + progress.remainingCount)) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-500" 
                    style={{ width: `${(progress.paidCount / (progress.paidCount + progress.remainingCount)) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>{t.paid || 'Paid'}: {progress.paidCount}</span>
                  <span>{t.remaining || 'Remaining'}: {progress.remainingCount}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); handleEditClick(expense); }} 
              className="flex-1 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <Edit2 className="w-3.5 h-3.5" />
              {t.edit || 'Edit'}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleDeleteExpense(expense); }} 
              className="flex-1 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.delete || 'Delete'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

