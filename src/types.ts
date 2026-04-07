export interface JobEntry {
  id: string;
  date: string; // ISO string (YYYY-MM-DDTHH:mm) or YYYY-MM-DD
  customerMustPay: number;
  upfrontCost: number;
  appNetIncome: number;
  actualReceived: number;
  transferred?: boolean;
}

export interface ExpenseEntry {
  id: string;
  date: string; // ISO string (YYYY-MM-DDTHH:mm) or YYYY-MM-DD
  amount: number;
  category: string;
  payee?: string;
  note?: string;
  isFixed?: boolean;
  necessity?: 'necessary' | 'luxury';
  durationMonths?: number;
  frequency?: 'monthly' | 'yearly';
  isIndefinite?: boolean;
  websiteUrl?: string;
  imageUrl?: string;
  isPaid?: boolean;
  groupId?: string;
}

export interface ActivityLog {
  id: string;
  type: 'add_job' | 'edit_job' | 'delete_job' | 'add_expense' | 'edit_expense' | 'delete_expense' | 'reset_data' | 'transfer_income';
  timestamp: string; // ISO string
  details: string;
  amount?: number;
}

export interface UserPreferences {
  dashboardWidgetOrder?: string[];
  expensesWidgetOrder?: string[];
  fixedExpensesOrder?: string[];
  isFixedExpensesLocked?: boolean;
  isCategoryOrderLocked?: boolean;
  customCategories?: string[];
  defaultCategories?: string[];
  expenseBalance?: number;
}

export interface Goal {
  id: string;
  type: 'daily' | 'monthly';
  targetAmount: number;
}

export interface DailySummary {
  totalCustomerMustPay: number;
  totalUpfront: number;
  totalAppNetIncome: number;
  totalReceived: number;
  totalTip: number;
  totalLoss?: number;
  grossIncome: number;
  netIncome: number;
  tipPercentage: number;
}
