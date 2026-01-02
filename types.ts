
export type Status = 'todo' | 'in_progress' | 'review' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

// --- RBAC Types ---
export type UserRole = 'admin' | 'user' | 'super_admin';

export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
}

export interface UserPermissions {
  routines: ModulePermissions;
  finance: ModulePermissions;
  commercial: ModulePermissions;
  reports: { view: boolean };
}

export interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  ownerEmail?: string;
  createdAt: string;
  // Real DB fields
  cnpj?: string;
  phone?: string;
  adminName?: string;
  planId?: string; // Foreign Key to SaasPlan
  planName?: string; // For UI display
  contractedModules?: string[]; // JSONB
  userCount?: number; // Calculated
  // New Real Fields
  type?: 'trial' | 'client' | 'internal';
  financialStatus?: 'ok' | 'overdue';
  lastActiveAt?: string;
  settings?: TenantSettings;
}

export interface TenantSettings {
  credit_card_expense_mode?: 'competence' | 'cash';
  // Future settings can go here
}

// --- Super Admin Types ---
export interface SaasPlan {
  id: string;
  name: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  features: string[]; // JSONB in DB - kept for legacy/simple lists
  allowedModules: string[]; // JSONB in DB - kept for backend validation
  maxUsers: number;
  active: boolean; // boolean flag for backward compatibility
  // New Real Fields
  type: 'trial' | 'public' | 'internal' | 'custom';
  status: 'active' | 'hidden' | 'archived';
  moduleConfig?: Record<string, 'included' | 'locked' | 'extra'>; // JSONB
}

export interface Delegation {
  id: string;
  ownerId: string;
  delegateId: string;
  module: 'agenda' | 'tasks' | 'finance' | 'commercial';
  permissions: {
    view: boolean;
    create: boolean;
    edit: boolean;
  };
  delegate?: User;
}

export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  role: UserRole;
  email: string;
  phone?: string;
  permissions?: UserPermissions;
  tenantId?: string; // Multi-tenant link
  companyName?: string; // Optional for global views
  // New Real Fields
  status?: 'active' | 'suspended' | 'blocked';
  lastActiveAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  projectId?: string;
  teamId?: string;
  assigneeId: string;
  dueDate: string;
  links: string[];
  tags: string[];
  tenantId?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on_hold';
  progress: number;
  dueDate: string;
  teamIds: string[];
  members: string[];
  links: string[];
  tenantId?: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  leadId: string;
  links: string[];
  tenantId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  isTeamEvent: boolean;
  startDate: string;
  endDate: string;
  participants: string[];
  description: string;
  links: string[];
  type: 'meeting' | 'deadline' | 'review';
  status: 'scheduled' | 'completed';
  tenantId?: string;
}

// --- Tipos Financeiros ---

export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountType = 'checking' | 'savings' | 'cash' | 'investment';

export interface FinancialAccount {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  tenantId?: string;
}

export interface FinancialTransaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  isPaid: boolean;
  accountId?: string;
  toAccountId?: string;
  categoryId?: string;
  creditCardId?: string;
  contactId?: string;
  originType?: 'manual' | 'quote' | 'recurring' | 'setup' | 'technical';
  originId?: string;
  links: string[];
  recurrenceId?: string;
  installmentIndex?: number;
  totalInstallments?: number;
  tenantId?: string;
}

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  tenantId?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  limitAmount: number;
  closingDay: number;
  dueDay: number;
  tenantId?: string;
}

// --- Tipos Comerciais (Novo Módulo) ---

export type ContactScope = 'client' | 'supplier' | 'both';
export type PersonType = 'pf' | 'pj';
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
export type CatalogType = 'product' | 'service';

export interface Contact {
  id: string;
  scope: ContactScope;
  type: PersonType;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  fantasyName?: string;
  document?: string;
  adminName?: string;
  notes?: string;
  tenantId?: string;
}

export interface CatalogItem {
  id: string;
  type: CatalogType;
  name: string;
  description?: string;
  price: number;
  active: boolean;
  financialCategoryId?: string;
  tenantId?: string;
}

export interface QuoteItem {
  id: string;
  catalogItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  catalogItem?: CatalogItem;
}

export interface Quote {
  id: string;
  contactId?: string;
  customerName?: string;
  customerPhone?: string;
  status: QuoteStatus;
  date: string;
  validUntil?: string;
  totalValue: number;
  notes?: string;
  contact?: Contact;
  items?: QuoteItem[];
  tenantId?: string;
}

export interface RecurringService {
  id: string;
  contactId: string;
  setupFee?: number;
  recurringAmount: number;
  startDate: string;
  frequency: 'monthly' | 'yearly';
  contractMonths?: number;
  active: boolean;
  contact?: Contact;
  tenantId?: string;
}

export interface DashboardMetrics {
  tasks: {
    total: number;
    pending: number;
    completed: number;
    urgent: number;
  };
  agenda: {
    today: number;
    next7Days: number;
    overdue: number;
  };
  commercial: {
    totalQuotes: number;
    pendingQuotes: number;
    approvedQuotes: number;
    convertedValue: number;
  };
  financial: {
    balance: number;
    overdueBills: number;
    dueIn7Days: number;
    receivables: number;
    receivablesIn7Days: number;
    overdueReceivables: number;
  };
}

export interface GlobalStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  activePlans: number;
}

// Interfaces auxiliares para Forms
export interface RecurrenceOptions {
  isRecurring: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  repeatCount: number;
}

export interface FinanceFilters {
  period: 'today' | 'last7' | 'month' | 'custom' | 'all';
  startDate?: string;
  endDate?: string;
  accountId: string;
  categoryId: string;
  type: 'all' | TransactionType;
}
