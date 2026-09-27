/**
 * A/R Tax Services, LLC - Accountant Dashboard Navigation Architecture
 * Strict compliance with the 20-item information architecture specification.
 */

import { NavGroup } from '../components/DashboardShell';
import {
  LayoutDashboard,
  Users,
  Calendar,
  FolderOpen,
  FileSpreadsheet,
  FileCheck2,
  AlertOctagon,
  FileQuestion,
  GitCompare,
  ShieldCheck,
  CheckCircle2,
  FileBarChart,
  History,
  UserCheck,
  KeyRound,
  Sparkles,
  FileCog,
  Workflow,
  FlaskConical,
  Settings
} from 'lucide-react';

export const ACCOUNTANT_NAV_GROUPS: NavGroup[] = [
  {
    id: 'main',
    label: 'Main Practice Center',
    defaultExpanded: true,
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'clients', label: 'Clients', icon: Users },
      { id: 'tax_years', label: 'Tax Years', icon: Calendar },
      { id: 'document_center', label: 'Document Center', icon: FolderOpen },
      { id: 'workpapers', label: 'Workpaper Center', icon: FileSpreadsheet },
      { id: 'tax_prep', label: 'Tax Preparation', icon: FileCheck2 },
      { id: 'exceptions', label: 'Exceptions', icon: AlertOctagon },
      { id: 'missing_docs', label: 'Missing Documents', icon: FileQuestion },
      { id: 'prior_year', label: 'Prior-Year Comparison', icon: GitCompare },
      { id: 'pre_filing_review', label: 'Pre-Filing Review', icon: ShieldCheck },
      { id: 'filing_readiness', label: 'Filing Readiness', icon: CheckCircle2 },
      { id: 'reports', label: 'Reports', icon: FileBarChart },
      { id: 'audit_log', label: 'Audit Log', icon: History }
    ]
  },
  {
    id: 'administration',
    label: 'Administration',
    defaultExpanded: true,
    items: [
      { id: 'team', label: 'Team', icon: UserCheck },
      { id: 'permissions', label: 'Roles & Permissions', icon: KeyRound },
      { id: 'ai_config', label: 'AI Configuration', icon: Sparkles },
      { id: 'doc_rules', label: 'Document Rules', icon: FileCog },
      { id: 'workflow_config', label: 'Workflow Configuration', icon: Workflow },
      { id: 'demo_env', label: 'Demo Environment', icon: FlaskConical },
      { id: 'settings', label: 'System Settings', icon: Settings }
    ]
  }
];
