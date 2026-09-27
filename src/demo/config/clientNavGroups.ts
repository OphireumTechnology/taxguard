/**
 * A/R Tax Services, LLC - Unified Client Dashboard Navigation Architecture
 * Strict Section 4 compliance: 9 expandable groups and 38 functions.
 */

import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileSpreadsheet,
  HelpCircle,
  BookOpen,
  Settings,
  ShieldCheck,
  CheckSquare,
  FolderLock,
  UploadCloud,
  Inbox,
  Sparkles,
  AlertCircle,
  Eye,
  Archive,
  Landmark,
  RefreshCw,
  Layers,
  History,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Scale,
  CheckCircle2,
  Calendar,
  BarChart3,
  Award,
  Calculator,
  TrendingUp,
  PenTool,
  Send,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  Bell,
  CreditCard,
  FileCheck,
  Phone,
  User,
  LogOut,
  ExternalLink
} from 'lucide-react';
import { NavGroup, NavItem } from '../components/DashboardShell';

export const CLIENT_NAV_GROUPS: NavGroup[] = [
  {
    id: 'home',
    label: 'Home',
    defaultExpanded: true,
    items: [
      { id: 'overview', label: 'Overview & Status', icon: LayoutDashboard }
    ]
  },
  {
    id: 'profile',
    label: 'My Profile & Engagement',
    defaultExpanded: true,
    items: [
      { id: 'entities', label: 'Entity Profile & Organization', icon: Building2 },
      { id: 'contacts', label: 'Owners, Spouse, Dependents & Contacts', icon: Users },
      { id: 'engagement', label: 'Engagement Details', icon: FileSpreadsheet },
      { id: 'questionnaire', label: 'Client Questionnaire', icon: HelpCircle },
      { id: 'organizer', label: 'Tax Organizer', icon: BookOpen },
      { id: 'preferences', label: 'Preferences', icon: Settings },
      { id: 'settings', label: 'Security & Consents', icon: ShieldCheck }
    ]
  },
  {
    id: 'documents',
    label: 'Documents & Checklist',
    defaultExpanded: true,
    items: [
      { id: 'collection_workspace', label: 'Stage 02 Collection Workspace', icon: CheckSquare },
      { id: 'checklist', label: 'Personalized Document Checklist', icon: CheckSquare },
      { id: 'vault', label: 'Document Vault', icon: FolderLock },
      { id: 'upload_center', label: 'Upload & Scan Center', icon: UploadCloud },
      { id: 'requests', label: 'Document Requests', icon: Inbox },
      { id: 'ai_pipeline', label: 'AI Processing Pipeline', icon: Sparkles },
      { id: 'missing_docs', label: 'Missing Documents', icon: AlertCircle },
      { id: 'review_status', label: 'Accountant Review Status', icon: Eye },
      { id: 'tax_package', label: 'Tax Document Package', icon: Archive }
    ]
  },
  {
    id: 'connections',
    label: 'Connections',
    defaultExpanded: false,
    items: [
      { id: 'bank_feeds', label: 'Bank Feeds & Connections', icon: Landmark },
      { id: 'accounting_sync', label: 'Cloud Accounting Sync', icon: RefreshCw },
      { id: 'integrations_center', label: 'Integration Center', icon: Layers },
      { id: 'import_history', label: 'Import History', icon: History }
    ]
  },
  {
    id: 'bookkeeping',
    label: 'Bookkeeping & Accounting',
    defaultExpanded: false,
    items: [
      { id: 'bookkeeping', label: 'Bookkeeping & Registers', icon: BookOpen },
      { id: 'income_expenses', label: 'Income & Expenses', icon: DollarSign },
      { id: 'customers_ar', label: 'Customers & Receivables', icon: ArrowDownRight },
      { id: 'vendors_ap', label: 'Vendors & Payables', icon: ArrowUpRight },
      { id: 'journal', label: 'General Journal', icon: FileSpreadsheet },
      { id: 'ledger', label: 'General Ledger', icon: BookOpen },
      { id: 'trial_balance', label: 'Trial Balance', icon: Scale },
      { id: 'reconciliation', label: 'Bank Reconciliation', icon: CheckCircle2 },
      { id: 'period_close', label: 'Period Close', icon: Calendar },
      { id: 'financial_reports', label: 'Financial Statements', icon: BarChart3 }
    ]
  },
  {
    id: 'tax_center',
    label: 'Tax Center',
    defaultExpanded: true,
    items: [
      { id: 'readiness', label: 'Tax Readiness Center', icon: Award },
      { id: 'estimated_tax', label: 'Estimated Taxes & Safe Harbor', icon: Calculator },
      { id: 'advisory', label: 'Tax Strategy & Scenarios', icon: TrendingUp },
      { id: 'return_review', label: 'Return Review & Form 8879', icon: PenTool },
      { id: 'filing_status', label: 'Filing & Acknowledgements', icon: Send },
      { id: 'notices', label: 'Tax Notices & Transcripts', icon: AlertTriangle },
      { id: 'amendments', label: 'Amendments & Closures', icon: RotateCcw }
    ]
  },
  {
    id: 'communication',
    label: 'Communication & Payments',
    defaultExpanded: false,
    items: [
      { id: 'messages', label: 'Messages & Tasks', icon: MessageSquare },
      { id: 'appointments', label: 'Appointments', icon: Calendar },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'billing', label: 'Fee Invoices & Payments', icon: CreditCard },
      { id: 'lender_package', label: 'Credit & Lender Package', icon: FileCheck }
    ]
  },
  {
    id: 'records',
    label: 'Records & Support',
    defaultExpanded: false,
    items: [
      { id: 'archive', label: 'Prior Year Archive', icon: Archive },
      { id: 'activity_history', label: 'Activity History', icon: History },
      { id: 'support', label: 'Help & Knowledge Base', icon: HelpCircle },
      { id: 'contact_support', label: 'Contact Support', icon: Phone }
    ]
  },
  {
    id: 'utilities',
    label: 'Utilities',
    defaultExpanded: false,
    items: [
      { id: 'util_ai', label: 'AI Advisory Assistant', icon: Sparkles },
      { id: 'util_integrations', label: 'Integration Status', icon: ExternalLink },
      { id: 'util_profile', label: 'User Profile', icon: User },
      { id: 'util_signout', label: 'Sign Out', icon: LogOut }
    ]
  }
];

// Flat lookup of all client nav items
export const ALL_CLIENT_NAV_ITEMS: NavItem[] = CLIENT_NAV_GROUPS.flatMap(g => g.items);

export const VALID_CLIENT_TABS = new Set([
  'overview',
  'entities',
  'contacts',
  'engagement',
  'questionnaire',
  'organizer',
  'preferences',
  'settings',
  'collection_workspace',
  'checklist',
  'vault',
  'upload_center',
  'requests',
  'ai_pipeline',
  'missing_docs',
  'review_status',
  'tax_package',
  'bank_feeds',
  'accounting_sync',
  'integrations_center',
  'import_history',
  'bookkeeping',
  'income_expenses',
  'customers_ar',
  'vendors_ap',
  'journal',
  'ledger',
  'trial_balance',
  'reconciliation',
  'period_close',
  'financial_reports',
  'readiness',
  'estimated_tax',
  'advisory',
  'tax_planning',
  'return_review',
  'filing_status',
  'notices',
  'amendments',
  'messages',
  'appointments',
  'notifications',
  'billing',
  'lender_package',
  'archive',
  'activity_history',
  'support',
  'contact_support',
  'voice_assistant'
]);

export function normalizeClientTab(rawTab?: string | null): string {
  if (!rawTab) return 'overview';
  const aliasMap: Record<string, string> = {
    upload_scan: 'upload_center',
    stage_two: 'collection_workspace',
    stage2: 'collection_workspace',
    collect: 'collection_workspace',
    collection: 'collection_workspace',
    document_requests: 'requests',
    ai_processing: 'ai_pipeline',
    accountant_review: 'review_status',
    engagement_details: 'engagement',
    receivables: 'customers_ar',
    payables: 'vendors_ap',
    filing_acks: 'filing_status',
    tax_planning: 'advisory',
    util_ai: 'voice_assistant',
    util_integrations: 'integrations_center',
    util_profile: 'entities',
    util_signout: 'settings'
  };
  const resolved = aliasMap[rawTab] || rawTab;
  return VALID_CLIENT_TABS.has(resolved) ? resolved : 'overview';
}
