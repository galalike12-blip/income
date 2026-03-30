export interface JobEntry {
  id: string;
  date: string; // ISO string (YYYY-MM-DDTHH:mm) or YYYY-MM-DD
  customerMustPay: number;
  upfrontCost: number;
  appNetIncome: number;
  actualReceived: number;
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
  isPaid?: boolean;
  groupId?: string;
}

export interface MonthlyBudget {
  month: string; // YYYY-MM
  amount: number;
}

export interface UserPreferences {
  dashboardWidgetOrder?: string[];
  expensesWidgetOrder?: string[];
  fixedExpensesOrder?: string[];
  isFixedExpensesLocked?: boolean;
  customCategories?: string[];
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
