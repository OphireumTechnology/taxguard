import React from 'react';
import { Archive, Calendar, ChevronLeft, ChevronRight, CreditCard, FileQuestion, FileText, LayoutDashboard, MessageSquare, Settings, ShieldCheck } from 'lucide-react';
import './clientDashboard.css';
const items = [
  { id: 'home', label: 'Dashboard', Icon: LayoutDashboard }, { id: 'tax_return', label: 'My Tax Returns', Icon: FileText },
  { id: 'documents', label: 'Documents', Icon: FileText }, { id: 'questionnaire', label: 'Questionnaire', Icon: FileQuestion },
  { id: 'requests', label: 'Requests', Icon: FileQuestion }, { id: 'messages', label: 'Messages', Icon: MessageSquare },
  { id: 'appointments', label: 'Appointments', Icon: Calendar }, { id: 'billing', label: 'Payments', Icon: CreditCard },
  { id: 'records', label: 'My Records (2022+)', Icon: Archive }, { id: 'settings', label: 'Settings', Icon: Settings },
];
export function ClientDashboardNavigation({ active, collapsed, onToggle, onNavigate, detailedWorkflow }: { active: string; collapsed: boolean; onToggle?: () => void; onNavigate: (id: string) => void; detailedWorkflow?: React.ReactNode }) {
  return <div className={`tg-client-navigation ${collapsed ? 'tg-client-nav-collapsed' : ''}`}>
    <div className="tg-client-nav-heading">{!collapsed && <strong>Client Dashboard</strong>}{onToggle && <button aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggle}>{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>}</div>
    <div className="tg-client-nav-items">{items.map(({ id, label, Icon }) => <button key={id} onClick={() => onNavigate(id)} title={label} aria-label={label} aria-current={active === id ? 'page' : undefined}><Icon size={17} aria-hidden="true" />{!collapsed && <span>{label}</span>}</button>)}</div>
    {!collapsed && <><div className="tg-client-nav-help"><strong>Need Help?</strong><p>Message your advisor or schedule an appointment.</p><button onClick={() => onNavigate('messages')}>Send Message</button><button onClick={() => onNavigate('appointments')}>Schedule Appointment</button></div>
      <details><summary>Workflow (18 Stages)</summary>{detailedWorkflow}</details><details><summary>Case &amp; Compliance</summary><button onClick={() => onNavigate('activity')}>Activity</button><button onClick={() => onNavigate('exceptions')}>Requests & Exceptions</button></details><details><summary>Account &amp; Security</summary><button onClick={() => onNavigate('profile')}>Profile</button><button onClick={() => onNavigate('security')}><ShieldCheck size={14} /> Security & Consent</button></details></>}
  </div>;
}
