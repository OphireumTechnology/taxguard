import React from 'react';
import {
  Activity, AlarmClock, AlertTriangle, BadgeCheck, BarChart3, Bot, Briefcase, Calculator, CalendarClock,
  ChevronDown, ChevronRight, ClipboardCheck, FileSearch, FileText, FolderOpen, Hourglass, Landmark,
  LayoutDashboard, LayoutTemplate, Library, ListChecks, PenLine, Search, Send, Signature, Sparkles,
  TrendingUp, UserPlus, Users, UsersRound, Workflow, Wrench, type LucideIcon,
} from 'lucide-react';

/**
 * Accountant sidebar. Sections expand independently; in icon-only mode every control keeps an
 * accessible name (aria-label) and shows a tooltip on hover and keyboard focus. Destinations are
 * existing workspace views only; tools without a verified integration stay visibly disabled.
 */
export interface NavItem { label: string; icon: LucideIcon; disabledReason?: string }
export interface NavSection { id: string; label: string; icon: LucideIcon; items: NavItem[] }

const UNAVAILABLE = 'Not available yet: requires a verified integration';
export const ACCOUNTANT_NAV_SECTIONS: NavSection[] = [
  { id: 'my-work', label: 'My Work', icon: Briefcase, items: [
    { label: 'My Cases', icon: FolderOpen }, { label: 'Needs Attention', icon: AlertTriangle },
    { label: 'Due Today', icon: CalendarClock }, { label: 'Overdue', icon: AlarmClock },
    { label: 'Waiting on Client', icon: Hourglass }, { label: 'Ready for Review', icon: ClipboardCheck },
  ] },
  { id: 'clients', label: 'Clients', icon: Users, items: [
    { label: 'All Clients', icon: Users }, { label: 'Search Clients', icon: Search },
    { label: 'Client Intake', icon: UserPlus, disabledReason: UNAVAILABLE },
  ] },
  { id: 'tax-workflow', label: 'Tax Workflow', icon: Workflow, items: [
    { label: 'Document Review', icon: FileSearch }, { label: 'AI Document Prep', icon: Sparkles },
    { label: 'Tax Return (Draft)', icon: FileText }, { label: 'Review & Edit', icon: PenLine },
    { label: 'Client Approval', icon: BadgeCheck }, { label: 'E-Signature', icon: Signature },
    { label: 'File to IRS/State', icon: Send }, { label: 'Track Status', icon: Activity },
  ] },
  { id: 'tools', label: 'Tools', icon: Wrench, items: [
    { label: 'AI Assistant', icon: Bot }, { label: 'Form Library', icon: Library },
    { label: 'State Tax Rules', icon: Landmark }, { label: 'Calculators', icon: Calculator, disabledReason: UNAVAILABLE },
    { label: 'Checklists', icon: ListChecks }, { label: 'Templates', icon: LayoutTemplate, disabledReason: UNAVAILABLE },
  ] },
  { id: 'reports', label: 'Reports', icon: BarChart3, items: [
    { label: 'My Productivity', icon: TrendingUp, disabledReason: UNAVAILABLE },
    { label: 'Team Overview', icon: UsersRound, disabledReason: UNAVAILABLE },
  ] },
];

interface Props {
  idPrefix: string;
  iconOnly: boolean;
  expanded: Record<string, boolean>;
  activeLabel: string;
  onToggleSection: (id: string) => void;
  onSelect: (label: string) => void;
}

export function AccountantNavigation({ idPrefix, iconOnly, expanded, activeLabel, onToggleSection, onSelect }: Props) {
  return (
    <div className={`tg-acct-nav${iconOnly ? ' tg-acct-nav--icons' : ''}`}>
      <button
        type="button"
        className="tg-acct-nav-item tg-acct-nav-home"
        aria-current={activeLabel === 'Dashboard' ? 'page' : undefined}
        aria-label={iconOnly ? 'Dashboard' : undefined}
        data-tooltip={iconOnly ? 'Dashboard' : undefined}
        onClick={() => onSelect('Dashboard')}
      >
        <LayoutDashboard size={18} aria-hidden="true" /><span className="tg-acct-nav-text">Dashboard</span>
      </button>
      {ACCOUNTANT_NAV_SECTIONS.map(section => {
        const open = iconOnly || expanded[section.id] !== false;
        const listId = `${idPrefix}-nav-${section.id}`;
        const SectionIcon = section.icon;
        return (
          <section key={section.id} className="tg-acct-nav-section">
            {iconOnly ? (
              <div className="tg-acct-nav-divider" role="presentation" title={section.label}><SectionIcon size={14} aria-hidden="true" /></div>
            ) : (
              <button
                type="button"
                className="tg-acct-nav-heading"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => onToggleSection(section.id)}
              >
                {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                <span>{section.label}</span>
              </button>
            )}
            <ul id={listId} hidden={!open} aria-label={section.label}>
              {section.items.map(item => {
                const Icon = item.icon;
                const name = item.disabledReason ? `${item.label} (${item.disabledReason.toLowerCase()})` : item.label;
                return (
                  <li key={item.label}>
                    <button
                      type="button"
                      className="tg-acct-nav-item"
                      disabled={Boolean(item.disabledReason)}
                      aria-current={activeLabel === item.label ? 'page' : undefined}
                      aria-label={iconOnly ? name : undefined}
                      title={item.disabledReason}
                      data-tooltip={iconOnly ? item.label : undefined}
                      onClick={() => onSelect(item.label)}
                    >
                      <Icon size={18} aria-hidden="true" /><span className="tg-acct-nav-text">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
