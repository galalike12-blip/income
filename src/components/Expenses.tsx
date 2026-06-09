import React, { useState, useMemo } from 'react';
import { JobEntry, ExpenseEntry, UserPreferences } from '../types';
import { Plus, Trash2, Calendar, DollarSign, Wallet, PieChart, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Circle, Edit2, GripVertical, ChevronDown, ChevronUp, Settings2, Filter, Check, Lock, Unlock, BarChart2, AlertCircle, ChevronRight, Camera, Loader2, X, Search, UtensilsCrossed, Fuel, Zap, Car, ShoppingBag, Wrench, HelpCircle, Home } from 'lucide-react';
import { Tooltip } from 'recharts';
import { motion, Reorder, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { ChevronLeft } from 'lucide-react';
import { translations } from '../i18n/translations';
import { useLocalStorage } from '../hooks/useLocalStorage';

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

interface ExpensesProps {
  jobs: JobEntry[];
  expenses: ExpenseEntry[];
  incentives: Record<string, number>;
  onEditExpense: (expense: ExpenseEntry) => void;
  updateExpense: (id: string, updates: Partial<ExpenseEntry>) => void;
  deleteExpense: (id: string) => void;
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  showResetConfirm: boolean;
  setShowResetConfirm: (show: boolean) => void;
  resetInput: string;
  setResetInput: (input: string) => void;
  handleResetData: () => Promise<void>;
  showSettings?: boolean;
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

const getCategoryIcon = (category: string) => {
  const cat = category.toLowerCase();
  
  // Predefined categories
  if (cat === 'food') return <UtensilsCrossed className="w-4 h-4" />;
  if (cat === 'fuel') return <Fuel className="w-4 h-4" />;
  if (cat === 'rent') return <Home className="w-4 h-4" />;
  if (cat === 'utilities') return <Zap className="w-4 h-4" />;
  if (cat === 'shopping') return <ShoppingBag className="w-4 h-4" />;
  if (cat === 'maintenance') return <Wrench className="w-4 h-4" />;
  if (cat === 'other') return <HelpCircle className="w-4 h-4" />;

  // Keyword matching for custom categories
  if (cat.includes('อาหาร') || cat.includes('กิน') || cat.includes('food') || cat.includes('eat') || cat.includes('ข้าว')) 
    return <UtensilsCrossed className="w-4 h-4" />;
  if (cat.includes('น้ำมัน') || cat.includes('fuel') || cat.includes('gas') || cat.includes('เชื้อเพลิง')) 
    return <Fuel className="w-4 h-4" />;
  if (cat.includes('ไฟ') || cat.includes('น้ำ') || cat.includes('utilities') || cat.includes('electric') || cat.includes('water')) 
    return <Zap className="w-4 h-4" />;
  if (cat.includes('รถ') || cat.includes('เดินทาง') || cat.includes('car') || cat.includes('travel') || cat.includes('ขนส่ง')) 
    return <Car className="w-4 h-4" />;
  if (cat.includes('ซื้อ') || cat.includes('ของ') || cat.includes('shopping') || cat.includes('buy') || cat.includes('ห้าง')) 
    return <ShoppingBag className="w-4 h-4" />;
  if (cat.includes('บ้าน') || cat.includes('เช่า') || cat.includes('rent') || cat.includes('home') || cat.includes('ที่พัก')) 
    return <Home className="w-4 h-4" />;
  if (cat.includes('ซ่อม') || cat.includes('maintenance') || cat.includes('repair') || cat.includes('บำรุง')) 
    return <Wrench className="w-4 h-4" />;
  
  return <HelpCircle className="w-4 h-4" />;
};

export function Expenses({ jobs, expenses, incentives, onEditExpense, updateExpense, deleteExpense, preferences, updatePreferences, showResetConfirm, setShowResetConfirm, resetInput, setResetInput, handleResetData, showSettings = false }: ExpensesProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  
  const customCategories = (preferences?.customCategories) || [];
  const setCustomCategories = (newCategories: string[]) => updatePreferences({ customCategories: newCategories });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [isCategoryOrderLocked, setIsCategoryOrderLocked] = useState(preferences?.isCategoryOrderLocked ?? true);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleToggleCategoryLock = () => {
    const newLocked = !isCategoryOrderLocked;
    setIsCategoryOrderLocked(newLocked);
    updatePreferences({ isCategoryOrderLocked: newLocked });
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) {
      setEditingCategory(null);
      return;
    }

    const updatedCategories = customCategories.map(c => c === oldName ? newName : c);
    setCustomCategories(updatedCategories);

    // Update all expenses with this category
    const affectedExpenses = expenses.filter(e => e.category === oldName);
    for (const exp of affectedExpenses) {
      await updateExpense(exp.id, { category: newName });
    }

    setEditingCategory(null);
    toast.success(`เปลี่ยนชื่อหมวดหมู่เป็น "${newName}" เรียบร้อยแล้ว`);
  };

  const validWidgets = ['summary', 'fixed', 'variable'];
  const savedOrder = preferences?.expensesWidgetOrder || [];
  const widgetOrder = savedOrder.length > 0 
    ? [...savedOrder.filter(id => validWidgets.includes(id)), ...validWidgets.filter(id => !savedOrder.includes(id))] 
    : validWidgets;
  const setWidgetOrder = (newOrder: string[]) => updatePreferences({ expensesWidgetOrder: newOrder });
  
  const [mainWidgetVisibility, setMainWidgetVisibility] = useLocalStorage('expenses-main-widget-visibility', {
    summary: true, fixed: true, variable: true
  });
  const fixedExpensesOrder = (preferences?.fixedExpensesOrder) || [];
  const setFixedExpensesOrder = (newOrder: string[]) => updatePreferences({ fixedExpensesOrder: newOrder });
  const [isFixedExpensesLocked, setIsFixedExpensesLocked] = useState(preferences?.isFixedExpensesLocked ?? true);
  const [variableExpenseDateFilter, setVariableExpenseDateFilter] = useState(() => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  const [variableHistoryMonthFilter, setVariableHistoryMonthFilter] = useState(() => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 7);
  });
  const [showVariableHistory, setShowVariableHistory] = useState(false);
  const [variableSearchQuery, setVariableSearchQuery] = useState('');
  const [variableCategoryFilter, setVariableCategoryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseEntry | null>(null);

  const handleEditClick = (expense: ExpenseEntry) => {
    onEditExpense(expense);
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

  const expenseBalance = (preferences?.expenseBalance) || 0;
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState(expenseBalance.toString());

  const handleBalanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(balanceInput);
    if (!isNaN(amount)) {
      updatePreferences({ expenseBalance: amount });
    }
    setIsEditingBalance(false);
  };

  const monthExpenses = useMemo(() => {
    return expenses.filter(e => e.date.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  const fixedExpenses = useMemo(() => {
    let fixed = monthExpenses.filter(e => e.isFixed);
    
    if (variableSearchQuery) {
      const query = variableSearchQuery.toLowerCase();
      fixed = fixed.filter(e => 
        (e.payee?.toLowerCase().includes(query)) || 
        (e.note?.toLowerCase().includes(query)) ||
        (t[e.category as keyof typeof t]?.toLowerCase().includes(query)) ||
        (e.category.toLowerCase().includes(query))
      );
    }
    
    if (variableCategoryFilter !== 'all') {
      fixed = fixed.filter(e => e.category === variableCategoryFilter);
    }

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
  }, [monthExpenses, fixedExpensesOrder, variableSearchQuery, variableCategoryFilter, t]);

  const variableExpenses = useMemo(() => {
    let filtered = monthExpenses.filter(e => !e.isFixed);
    
    if (variableSearchQuery) {
      const query = variableSearchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        (e.payee?.toLowerCase().includes(query)) || 
        (e.note?.toLowerCase().includes(query)) ||
        (t[e.category as keyof typeof t]?.toLowerCase().includes(query)) ||
        (e.category.toLowerCase().includes(query))
      );
    }
    
    if (variableCategoryFilter !== 'all') {
      filtered = filtered.filter(e => e.category === variableCategoryFilter);
    }
    
    return filtered;
  }, [monthExpenses, variableSearchQuery, variableCategoryFilter, t]);

  const groupedVariableHistory = useMemo(() => {
    let filtered = expenses.filter(e => !e.isFixed && e.date.startsWith(variableHistoryMonthFilter));
    
    if (variableSearchQuery) {
      const query = variableSearchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        (e.payee?.toLowerCase().includes(query)) || 
        (e.note?.toLowerCase().includes(query)) ||
        (t[e.category as keyof typeof t]?.toLowerCase().includes(query)) ||
        (e.category.toLowerCase().includes(query))
      );
    }
    
    if (variableCategoryFilter !== 'all') {
      filtered = filtered.filter(e => e.category === variableCategoryFilter);
    }

    const groups: Record<string, ExpenseEntry[]> = {};
    
    filtered.forEach(exp => {
      const dateKey = exp.date.split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(exp);
    });
    
    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => {
        items.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return { date, items };
      });
  }, [expenses, variableSearchQuery, variableCategoryFilter, t, variableHistoryMonthFilter]);

  const totalFixed = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalFixedPaid = fixedExpenses.filter(e => e.isPaid).reduce((sum, e) => sum + e.amount, 0);
  const totalFixedUnpaid = fixedExpenses.filter(e => !e.isPaid).reduce((sum, e) => sum + e.amount, 0);
  const totalVariable = variableExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = totalFixed + totalVariable;

  const handleResetDataInternal = async () => {
    if (resetInput === 'RESET') {
      try {
        await handleResetData();
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

  return (
    <div className="max-w-5xl mx-auto px-4 pt-2 pb-0 space-y-6">
      {/* Header & Month Picker */}
      <div className="flex flex-col gap-3 glass-panel p-4 rounded-3xl transition-colors">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t.expenseManagement || 'ระบบจัดการรายจ่าย'}</h1>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button 
            onClick={() => {
              const today = new Date();
              setSelectedMonth(new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().slice(0, 7));
            }}
            className="px-4 h-[38px] flex items-center justify-center text-sm font-medium text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100/80 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-2xl transition-colors backdrop-blur-sm"
          >
            {t.today || 'วันนี้'}
          </button>
          <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/50 dark:border-slate-700/50 p-1 px-3 rounded-2xl flex items-center justify-between min-h-[38px] shrink-0">
            <button onClick={() => {
              const [y, m] = selectedMonth.split('-').map(Number);
              const d = new Date(y, m - 2);
              setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
            <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate px-2 min-w-[100px] text-center">
              {new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1).toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US', { month: 'short', year: 'numeric' })}
            </span>
            <button disabled={selectedMonth === new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 7)} onClick={() => {
              const [y, m] = selectedMonth.split('-').map(Number);
              const d = new Date(y, m);
              setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
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
            className="overflow-hidden mb-6"
          >
            <div className="glass-panel p-4 rounded-[2rem] space-y-3 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10">
              <h4 className="text-sm font-black text-slate-800 dark:text-white px-2 mb-2">ตั้งค่าวิดเจ็ตหลัก</h4>
              <Reorder.Group axis="y" values={widgetOrder} onReorder={setWidgetOrder} className="space-y-2">
                {widgetOrder.map(id => (
                  <Reorder.Item key={id} value={id} className={`p-3 rounded-2xl flex items-center gap-3 transition-colors ${mainWidgetVisibility[id as keyof typeof mainWidgetVisibility] ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white' : 'bg-white/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500'}`}>
                    <div 
                      onClick={() => setMainWidgetVisibility({...mainWidgetVisibility, [id]: !mainWidgetVisibility[id as keyof typeof mainWidgetVisibility]})}
                      className="flex-1 flex items-center gap-3 cursor-pointer"
                    >
                      {mainWidgetVisibility[id as keyof typeof mainWidgetVisibility] ? <CheckCircle2 className="text-emerald-500 w-5 h-5"/> : <Circle className="text-slate-300 dark:text-slate-600 w-5 h-5"/>}
                      <span className="font-medium text-sm">
                        {id === 'summary' && (t.budgetSummary || 'สรุปงบประมาณ')}
                        {id === 'fixed' && (t.fixedCosts || 'รายจ่ายคงที่ (Fixed Costs)')}
                        {id === 'variable' && (t.variableCosts || 'รายจ่ายผันแปร (Variable Costs)')}
                      </span>
                    </div>
                    <GripVertical className="text-slate-400 cursor-grab active:cursor-grabbing" />
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
          {widgetOrder.map(id => {
            if (!mainWidgetVisibility[id as keyof typeof mainWidgetVisibility]) return null;
            return (
            <div key={id}>
              {id === 'summary' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Wallet className="w-16 h-16 text-emerald-500" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      ยอดเงินคงเหลือในบัญชีรายจ่าย
                    </h3>
                    {isEditingBalance ? (
                      <form onSubmit={handleBalanceSubmit} className="flex gap-2 mt-2">
                        <input
                          type="number"
                          value={balanceInput}
                          onChange={e => setBalanceInput(e.target.value)}
                          className="w-full px-3 py-1 glass-input rounded-lg"
                          autoFocus
                          onBlur={handleBalanceSubmit}
                        />
                      </form>
                    ) : (
                      <div 
                        className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          setBalanceInput(expenseBalance.toString());
                          setIsEditingBalance(true);
                        }}
                      >
                        ฿{expenseBalance.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    <div className="flex flex-col gap-1 mt-2 text-sm">
                      <div className="flex justify-between text-slate-500">
                        <span>{t.fixed || 'คงที่'}:</span>
                        <span>฿{totalFixed.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                        <span className="text-emerald-500">{t.paid || 'จ่ายแล้ว'}:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">฿{totalFixedPaid.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                        <span className="text-rose-400">{t.unpaid || 'ยังไม่จ่าย'}:</span>
                        <span className="text-rose-500 dark:text-rose-400 font-bold">฿{totalFixedUnpaid.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 mt-1">
                        <span>{t.variable || 'ผันแปร'}:</span>
                        <span>฿{totalVariable.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <PieChart className="w-16 h-16 text-indigo-500" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t.necessityRatio || 'สัดส่วนความจำเป็น'}</h3>
                    <div className="flex items-end gap-2">
                      <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                        {totalExpenses > 0 ? Math.round((totalNecessary / totalExpenses) * 100) : 0}%
                      </div>
                      <div className="text-sm text-slate-500 mb-1">จำเป็น</div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-3">
                      <div 
                        className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${totalExpenses > 0 ? (totalNecessary / totalExpenses) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
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
            <p className="text-center text-slate-500 py-8 glass-panel rounded-2xl border-dashed border-2 border-slate-200 dark:border-slate-700">
              {(variableSearchQuery || variableCategoryFilter !== 'all') 
                ? (t.noResultsFound || 'ไม่พบผลลัพธ์ที่ตรงตามเงื่อนไข') 
                : (t.noFixedExpenses || 'ไม่มีรายจ่ายคงที่ในเดือนนี้')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {fixedExpenses.map(expense => (
                <ExpenseItem
                  key={expense.id}
                  expense={expense}
                  updateExpense={updateExpense}
                  handleEditClick={handleEditClick}
                  handleDeleteExpense={handleDeleteExpense}
                  getFaviconUrl={getFaviconUrl}
                  t={t}
                  isFixed={true}
                  progress={getGroupProgress(expense.groupId)}
                  expandedExpenseId={expandedExpenseId}
                  setExpandedExpenseId={setExpandedExpenseId}
                />
              ))}
            </div>
          )}
        </div>

              )}
              {id === 'variable' && (
                <div className="glass-panel p-6 rounded-3xl">
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                          {showVariableHistory ? t.history : t.variableCosts || 'รายจ่ายผันแปร (Variable Costs)'}
                        </h3>
                        <button 
                          onClick={() => setShowVariableHistory(!showVariableHistory)}
                          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full"
                        >
                          {showVariableHistory ? t.today : t.history}
                        </button>
                      </div>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        title={t.filter || 'ตัวกรอง'}
                        className={`p-2 shrink-0 flex items-center justify-center rounded-2xl transition-all border ${showFilters || variableSearchQuery || variableCategoryFilter !== 'all' ? 'border-indigo-200 dark:border-indigo-800 text-indigo-600 bg-indigo-50/50 dark:text-indigo-400 dark:bg-indigo-900/30' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        <Filter className="w-5 h-5" />
                      </button>
                    </div>

                    <AnimatePresence>
                      {showFilters && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="glass-panel p-4 rounded-3xl flex flex-col md:flex-row items-start md:items-center gap-4 mb-2">
                            <div className="flex-1 w-full relative">
                              <input 
                                type="text"
                                placeholder={t.search || 'ค้นหา...'}
                                value={variableSearchQuery}
                                onChange={(e) => setVariableSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 glass-input rounded-2xl text-sm"
                              />
                              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <Search className="w-4 h-4" />
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => setIsManagingCategories(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl text-sm font-medium hover:bg-indigo-100 transition-colors"
                              >
                                <Settings2 className="w-4 h-4" />
                                {t.manageCategories || 'จัดการหมวดหมู่'}
                              </button>

                              <select
                                value={variableCategoryFilter}
                                onChange={(e) => setVariableCategoryFilter(e.target.value)}
                                className="px-4 py-2 glass-input rounded-2xl text-sm min-w-[150px]"
                              >
                                <option value="all">{t.allCategories || 'ทุกหมวดหมู่'}</option>
                                {[...new Set(expenses.map(e => e.category))].map(cat => (
                                  <option key={cat} value={cat}>{t[cat as keyof typeof t] || cat}</option>
                                ))}
                              </select>

                              {(variableSearchQuery || variableCategoryFilter !== 'all') && (
                                <button
                                  onClick={() => {
                                    setVariableSearchQuery('');
                                    setVariableCategoryFilter('all');
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-colors text-sm font-medium"
                                >
                                  <X className="w-4 h-4" />
                                  {t.clearFilters || 'ล้างตัวกรอง'}
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                      
                      {showVariableHistory ? (
                        <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/50 dark:border-slate-700/50 p-1 px-3 rounded-2xl flex items-center justify-between min-h-[38px] shrink-0">
                          <button onClick={() => {
                            const [y, m] = variableHistoryMonthFilter.split('-').map(Number);
                            const d = new Date(y, m - 2);
                            setVariableHistoryMonthFilter(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                          }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate px-2 min-w-[90px] text-center">
                            {new Date(parseInt(variableHistoryMonthFilter.split('-')[0]), parseInt(variableHistoryMonthFilter.split('-')[1]) - 1).toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US', { month: 'short', year: 'numeric' })}
                          </span>
                          <button disabled={variableHistoryMonthFilter === new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 7)} onClick={() => {
                            const [y, m] = variableHistoryMonthFilter.split('-').map(Number);
                            const d = new Date(y, m);
                            setVariableHistoryMonthFilter(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                          }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded-xl transition-colors cursor-pointer"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
                        </div>
                      ) : (
                        <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/50 dark:border-slate-700/50 p-1 px-3 rounded-2xl flex items-center justify-between min-h-[38px] shrink-0">
                          <button onClick={() => {
                            const d = new Date(variableExpenseDateFilter);
                            d.setDate(d.getDate() - 1);
                            setVariableExpenseDateFilter(d.toISOString().split('T')[0]);
                          }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
                          <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate px-2 min-w-[90px] text-center">
                            {new Date(variableExpenseDateFilter).toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <button disabled={variableExpenseDateFilter === new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]} onClick={() => {
                            const d = new Date(variableExpenseDateFilter);
                            d.setDate(d.getDate() + 1);
                            setVariableExpenseDateFilter(d.toISOString().split('T')[0]);
                          }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 rounded-xl transition-colors cursor-pointer"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
                        </div>
                      )}
                    </div>
                  </div>

                  {!showVariableHistory ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {variableExpenses.filter(e => e.date.startsWith(variableExpenseDateFilter)).length === 0 ? (
                        <div className="sm:col-span-2">
                          <p className="text-center text-slate-500 py-8 glass-panel rounded-2xl border-dashed border-2 border-slate-200 dark:border-slate-700">
                            {(variableSearchQuery || variableCategoryFilter !== 'all') 
                              ? (t.noResultsFound || 'ไม่พบผลลัพธ์ที่ตรงตามเงื่อนไข') 
                              : (t.noVariableExpenses || 'ไม่มีรายจ่ายผันแปรในวันที่เลือก')}
                          </p>
                        </div>
                      ) : (
                        variableExpenses.filter(e => e.date.startsWith(variableExpenseDateFilter)).map(expense => (
                          <ExpenseItem
                            key={expense.id}
                            expense={expense}
                            updateExpense={updateExpense}
                            handleEditClick={handleEditClick}
                            handleDeleteExpense={handleDeleteExpense}
                            getFaviconUrl={getFaviconUrl}
                            t={t}
                            isFixed={false}
                            expandedExpenseId={expandedExpenseId}
                            setExpandedExpenseId={setExpandedExpenseId}
                          />
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {groupedVariableHistory.length === 0 ? (
                        <div className="glass-panel-subtle border-dashed rounded-3xl p-10 text-center text-slate-500 dark:text-slate-400 transition-colors">
                          {(variableSearchQuery || variableCategoryFilter !== 'all') 
                            ? (t.noResultsFound || 'ไม่พบผลลัพธ์ที่ตรงตามเงื่อนไข') 
                            : (t.noDataForRange || 'ไม่มีข้อมูลในช่วงเวลานี้')}
                        </div>
                      ) : (
                        groupedVariableHistory.map((group) => (
                          <div key={group.date} className="space-y-2">
                            <div className="flex items-center gap-2 px-2">
                              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                                {new Date(group.date + 'T00:00:00').toLocaleDateString(currentLang === 'th' ? 'th-TH' : currentLang === 'zh' ? 'zh-CN' : 'en-US', { 
                                  day: 'numeric',
                                  month: 'short', 
                                  year: 'numeric' 
                                })}
                              </span>
                              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                                  expandedExpenseId={expandedExpenseId}
                                  setExpandedExpenseId={setExpandedExpenseId}
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
          })}
        </div>

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
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {t.manageCategories || 'จัดการหมวดหมู่'}
              </h3>
              <button
                onClick={handleToggleCategoryLock}
                className={`p-2 rounded-xl transition-colors ${
                  isCategoryOrderLocked 
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' 
                    : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                }`}
                title={isCategoryOrderLocked ? 'ปลดล็อกเพื่อจัดเรียง' : 'ล็อกตำแหน่ง'}
              >
                {isCategoryOrderLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {isCategoryOrderLocked 
                ? (t.unlockToReorder || 'ปลดล็อกเพื่อจัดลำดับหมวดหมู่') 
                : (t.dragToReorder || 'ลากเพื่อจัดลำดับหมวดหมู่')}
            </p>

            <div className="mb-4 flex gap-2">
              <input 
                type="text" 
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder={t.addNewCategory || 'เพิ่มหมวดหมู่ใหม่'}
                className="flex-1 px-4 py-2 glass-input rounded-xl text-sm"
              />
              <button 
                onClick={() => {
                  if (newCategoryName.trim() && !customCategories.includes(newCategoryName.trim())) {
                    setCustomCategories([...customCategories, newCategoryName.trim()]);
                    setNewCategoryName('');
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mb-6">
              {customCategories.length === 0 ? (
                <p className="text-slate-500 text-center py-4">{t.noCustomCategories || 'ไม่มีหมวดหมู่ที่เพิ่มเอง'}</p>
              ) : (
                <Reorder.Group 
                  axis="y" 
                  values={customCategories} 
                  onReorder={setCustomCategories}
                  className="space-y-2 max-h-[50vh] overflow-y-auto pr-2"
                >
                  {customCategories.map(cat => (
                    <Reorder.Item 
                      key={cat} 
                      value={cat}
                      dragListener={!isCategoryOrderLocked}
                      className={`flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-transparent ${!isCategoryOrderLocked ? 'active:border-indigo-500/50 active:shadow-sm' : ''}`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {!isCategoryOrderLocked && (
                          <GripVertical className="w-4 h-4 text-slate-400 cursor-grab active:cursor-grabbing" />
                        )}
                        {editingCategory === cat ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input 
                              type="text"
                              value={editCategoryName}
                              onChange={e => setEditCategoryName(e.target.value)}
                              className="flex-1 px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-indigo-500 rounded-lg outline-none"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameCategory(cat, editCategoryName);
                                if (e.key === 'Escape') setEditingCategory(null);
                              }}
                            />
                            <button onClick={() => handleRenameCategory(cat, editCategoryName)} className="p-1 text-emerald-500">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingCategory(null)} className="p-1 text-slate-400">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{getCategoryName(cat)}</span>
                        )}
                      </div>
                      
                      {editingCategory !== cat && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setEditingCategory(cat);
                              setEditCategoryName(cat);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              const expensesInCategory = expenses.filter(e => e.category === cat);
                              if (expensesInCategory.length > 0) {
                                toast.error(`ไม่สามารถลบหมวดหมู่ "${cat}" ได้ เพราะยังมีรายการค่าใช้จ่ายที่ใช้หมวดหมู่นี้อยู่`);
                              } else {
                                setCustomCategories(customCategories.filter(c => c !== cat));
                              }
                            }}
                            className="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
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

function ExpenseItem({ expense, updateExpense, handleEditClick, handleDeleteExpense, getFaviconUrl, t, isFixed, progress, expandedExpenseId, setExpandedExpenseId }: any) {
  const isExpanded = expandedExpenseId === expense.id;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden h-full flex flex-col shadow-md hover:shadow-lg ${
        expense.isPaid 
          ? 'bg-emerald-50/20 dark:bg-emerald-900/5 border-emerald-100 dark:border-emerald-800/20' 
          : 'bg-white/60 dark:bg-slate-800/60 border-white/40 dark:border-slate-700/50'
      }`}
    >
      <div 
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors flex-1"
        onClick={() => isExpanded ? setExpandedExpenseId(null) : setExpandedExpenseId(expense.id)}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${expense.isPaid ? 'bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-indigo-100/50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'} overflow-hidden`}>
            {getFaviconUrl(expense.websiteUrl) ? (
              <img src={getFaviconUrl(expense.websiteUrl)!} alt="icon" className="w-6 h-6 rounded-full bg-white p-0.5" referrerPolicy="no-referrer" />
            ) : (
              <div className="text-current">
                {getCategoryIcon(expense.category)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5 flex items-center gap-2">
              <span>
                {expense.category === 'food' ? t.food || 'Food' : 
                 expense.category === 'fuel' ? t.fuel || 'Fuel' : 
                 expense.category === 'rent' ? t.rent || 'Rent' : 
                 expense.category === 'utilities' ? t.utilities || 'Utilities' : 
                 expense.category === 'shopping' ? t.shopping || 'Shopping' : 
                 expense.category === 'maintenance' ? t.maintenance || 'Maintenance' : 
                 expense.category === 'other' ? t.other || 'Other' : expense.category}
              </span>
              {expense.date.includes('T') && (
                <span className="text-[10px]">{expense.date.split('T')[1]}</span>
              )}
            </div>
            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-2">
              {expense.payee || (expense.category === 'food' ? t.food || 'Food' : 
                 expense.category === 'fuel' ? t.fuel || 'Fuel' : 
                 expense.category === 'rent' ? t.rent || 'Rent' : 
                 expense.category === 'utilities' ? t.utilities || 'Utilities' : 
                 expense.category === 'shopping' ? t.shopping || 'Shopping' : 
                 expense.category === 'maintenance' ? t.maintenance || 'Maintenance' : 
                 expense.category === 'other' ? t.other || 'Other' : expense.category)}
              {expense.isPaid && (
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md font-bold uppercase tracking-tighter">
                  {t.paid || 'จ่ายแล้ว'}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-bold uppercase tracking-tighter text-slate-400 mb-0.5">{t.amount || 'จำนวน'}</div>
            <div className={`font-black ${expense.isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              ฿{(expense.amount ?? 0).toLocaleString()}
            </div>
            {expense.isPaid && expense.balanceAfter !== undefined && (
              <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                คงเหลือ ฿{expense.balanceAfter.toLocaleString()}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isFixed && (
              <button 
                onClick={(e) => { e.stopPropagation(); updateExpense(expense.id, { isPaid: !expense.isPaid }); }}
                className="flex-shrink-0 focus:outline-none mr-1"
              >
                {expense.isPaid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-indigo-400 transition-colors" />
                )}
              </button>
            )}
            {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-slate-50/80 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-4">
            <div className="flex items-center justify-between text-sm sm:hidden">
              <span className="text-slate-400 font-medium">{t.amount || 'จำนวน'}</span>
              <div className="text-right">
                <span className={`font-semibold block ${expense.isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  ฿{(expense.amount ?? 0).toLocaleString()}
                </span>
                {expense.isPaid && expense.balanceAfter !== undefined && (
                  <span className="text-[10px] font-semibold text-slate-500 block leading-tight">
                    คงเหลือ ฿{expense.balanceAfter.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 font-medium">{t.date || 'วันที่'}</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">
                {new Date(expense.date.length === 10 ? expense.date + 'T00:00:00' : expense.date).toLocaleString(t.locale || 'th-TH', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 font-medium">{t.payee || 'ผู้รับ'}</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">{expense.payee || '-'}</span>
            </div>
          </div>

          {isFixed && progress && (
            <div className="p-4 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl border border-indigo-100/50 dark:border-indigo-800/20 mb-4">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
                <span>{t.paymentProgress || 'PAYMENT PROGRESS'}</span>
                <span>{Math.round((progress.paidCount / progress.totalCount) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-500" 
                  style={{ width: `${(progress.paidCount / progress.totalCount) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2">
                <span>{t.paidMonths || 'จ่ายแล้ว'}: {progress.paidCount} {t.months || 'เดือน'}</span>
                <span>{t.remainingMonths || 'เหลือ'}: {progress.remainingCount} {t.months || 'เดือน'}</span>
              </div>
            </div>
          )}

          {expense.note && (
            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-500 italic mb-4 border border-slate-100 dark:border-slate-700">
              {expense.note}
            </div>
          )}

          <div className="flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); handleEditClick(expense); }} 
              className="flex-1 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <Edit2 className="w-3.5 h-3.5" />
              {t.edit || 'แก้'}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleDeleteExpense(expense); }} 
              className="flex-1 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.delete || 'ลบ'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

