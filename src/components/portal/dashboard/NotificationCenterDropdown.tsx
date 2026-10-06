/**
 * A/R Tax Services, LLC - TaxGuard AI
 * In-App Notification Center Dropdown
 *
 * Implements:
 * - Section 31: In-app notifications for client events
 * - New requests, document status updates, review complete, etc.
 */

import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  X,
  ArrowRight
} from 'lucide-react';

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  targetNav?: string;
}

export interface NotificationCenterDropdownProps {
  notifications?: InAppNotification[];
  onNavigateToTab?: (tabId: string) => void;
}

export const NotificationCenterDropdown: React.FC<NotificationCenterDropdownProps> = ({
  notifications: initialNotifications = [],
  onNavigateToTab
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>(() => {
    if (initialNotifications.length > 0) return initialNotifications;
    return [
      {
        id: 'notif_1',
        title: 'Checklist Generated',
        message: 'Personalized document requirements are ready for your review.',
        timestamp: 'Today',
        isRead: false,
        targetNav: 'checklist'
      },
      {
        id: 'notif_2',
        title: 'IRC § 7216 Consent Verified',
        message: 'Your privacy consent and taxpayer authorizations are recorded.',
        timestamp: 'Yesterday',
        isRead: true,
        targetNav: 'security'
      }
    ];
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleItemClick = (notif: InAppNotification) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    if (notif.targetNav && onNavigateToTab) {
      onNavigateToTab(notif.targetNav);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg border border-slate-700/60 hover:bg-[#0D2745] text-slate-300 hover:text-white transition-colors relative cursor-pointer"
        aria-label="View notifications"
        title="Notification Center"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D4A843] text-[#06182B] text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[#071A2E] border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden text-xs">
          <div className="p-3 bg-[#06182B] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Bell className="w-3.5 h-3.5 text-[#D4A843]" />
              <span>Notifications</span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[10px] text-[#D4A843] hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/80">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-slate-400">
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3 transition-colors cursor-pointer hover:bg-[#0D2745] ${
                    !n.isRead ? 'bg-[#0A2544]/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-semibold text-[11px] ${!n.isRead ? 'text-white' : 'text-slate-300'}`}>
                      {n.title}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">{n.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">{n.message}</p>
                </div>
              ))
            )}
          </div>

          <div className="p-2 bg-[#06182B] border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[10px] text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
