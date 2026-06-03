export type TransactionType = 
  | 'SALE'
  | 'PURCHASE'
  | 'DUE_PAYMENT'
  | 'HAWLAT_GIVEN'
  | 'HAWLAT_RECEIVED'
  | 'EXPENSE'
  | 'STOCK_IN'
  | 'SECONDHAND_BUY'
  | 'OPENING'
  | 'CLOSING';

export type TransactionMode = 'CASH' | 'BANK' | 'BKASH' | 'NAGAD' | 'CARD' | 'DUE';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface TransactionCreateInput {
  type: TransactionType;
  amount: number;
  costAmount?: number;
  mode: TransactionMode;
  description?: string;
  barcode?: string;
  productId?: string;
  customerId?: string;
  supplierId?: string;
  loanId?: string;
  referenceId?: string;
  referenceType?: string;
}

export interface TransactionFilter {
  type?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  days?: number;
  storeId?: string;
}

export interface DailySummary {
  totalSales: number;
  cashSales: number;
  dueSales: number;
  collections: number;
  expenses: number;
  netCash: number;
  transactionCount: number;
  profit: number;
}


export interface CapitalSummary {
  ownedStockValue: number;
  supplierDue: number;
  loansOutstanding: number;
  netCapital: number;
}

export interface SupplierCreateInput {
  name: string;
  phone?: string;
  address?: string;
}

export interface SupplierUpdateInput {
  name?: string;
  phone?: string;
  address?: string;
  dueAdjustment?: number;
  note?: string;
}

export interface SupplierProductInput {
  productIds?: string[];
  newProducts?: string[];
}

export interface LoanCreateInput {
  personName: string;
  type: 'GIVE' | 'TAKE';
  amount: number;
  mode?: TransactionMode;
  description?: string;
}

export interface LoanPaymentInput {
  amount: number;
  mode?: TransactionMode;
  note?: string;
}

export interface ReportPeriod {
  start: string;
  end: string;
  label: string;
}

export interface ReportSummary {
  totalSales: number;
  salesCount: number;
  cashCollected: number;
  totalDue: number;
  totalExpenses: number;
  netProfit: number;
}

export interface StockSummary {
  totalValue: number;
  productCount: number;
  unitsInStock: number;
}

export interface CustomerSummary {
  total: number;
  withDue: number;
  totalDueOutstanding: number;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  total?: number;
  page?: number;
  limit?: number;
}

export type StoreStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'TRIAL';

export interface PlanFeature {
  name: string;
  included: boolean;
}

export interface StoreOnboardingInput {
  businessType: string;
  address?: string;
  phone?: string;
}

export interface UserSignUpInput {
  name: string;
  username: string;
  password?: string;
  storeName: string;
}