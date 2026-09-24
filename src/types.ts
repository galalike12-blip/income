export interface JobEntry {
  id: string;
  date: string; // ISO string (YYYY-MM-DDTHH:mm) or YYYY-MM-DD
  customerMustPay: number;
  upfrontCost: number;
  appNetIncome: number;
  actualReceived: number;
  transferred?: boolean;
  jobTitle?: string;
  workType?: 'rider' | 'freelance' | 'salary';
  isMultiDay?: boolean;
  endDate?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupCoords?: { lat: number; lng: number };
  dropoffCoords?: { lat: number; lng: number };
  routePoints?: Array<{ lat: number; lng: number; timestamp: string }>;
  status?: 'in_progress' | 'completed';
  tripStartTime?: string;
  tripEndTime?: string;
  tripDurationMinutes?: number;
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
  balanceAfter?: number;
  transactionId?: string; // เลขที่รายการสลิป / Slip Transaction ID to prevent duplication
}

export interface ActivityLog {
  id: string;
  type: 'add_job' | 'edit_job' | 'delete_job' | 'add_expense' | 'edit_expense' | 'delete_expense' | 'reset_data' | 'transfer_income' | 'edit_balance' | 'edit_incentive';
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
  dailyBalances?: Record<string, number>;
  leaveDays?: string[];
  leaveReasons?: Record<string, string>;
  workType?: 'rider' | 'freelance' | 'salary';
  baseSalary?: number;
  salaryPayday?: number;
  hasCompletedOnboarding?: boolean;
  riderMinDailyTarget?: number;
  geminiModel?: string;
  customAiInstructions?: string;
  enableVoiceFeedback?: boolean;
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
