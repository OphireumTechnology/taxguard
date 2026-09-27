import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface NotificationBellProps {
  size?: 'sm' | 'md';
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ size = 'md' }) => {
  const { notifications, markNotificationRead, clearAllNotifications, setCurrentPage } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const notifsList = notifications || [];
  const unreadCount = notifsList.filter(n => !n.isRead).length;

  // Handle outside clicks and Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Info className="w-4 h-4 text-[#C99A3D]" />;
    }
  };

  const accessibleLabel = unreadCount > 0 
    ? `Notifications, ${unreadCount} unread`
    : 'Notifications';

  const isSmall = size === 'sm';

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={accessibleLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={isSmall
          ? "relative w-7 h-7 rounded-md text-slate-300 hover:text-white hover:bg-[#0D2340] border border-transparent hover:border-[#1E3A5F] transition-all flex items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C99A3D]"
          : "relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-slate-300 hover:text-white hover:bg-[#0B2748] border border-transparent hover:border-[#1E3A5F] transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C99A3D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06172C]"
        }
      >
        <Bell className={isSmall ? "w-3.5 h-3.5 text-slate-300" : "w-5 h-5 text-slate-200"} aria-hidden="true" />
        {unreadCount > 0 && (
          <span 
            className={isSmall
              ? "absolute -top-1 -right-1 flex min-w-[15px] h-[15px] px-0.5 items-center justify-center rounded-full bg-[#C99A3D] text-[9px] font-bold text-[#06172C] leading-none pointer-events-none ring-1 ring-[#040D1A]"
              : "absolute top-1 right-1 flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-[#C99A3D] text-[10px] font-bold text-[#06172C] shadow-sm leading-none pointer-events-none ring-2 ring-[#06172C]"
            }
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          ref={dropdownRef}
          role="dialog"
          aria-label="Recent notifications"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-[#0B2748] border border-[#1E3A5F] shadow-2xl z-50 overflow-hidden text-slate-100 animate-in fade-in slide-in-from-top-2"
        >
          <div className="p-3.5 bg-[#06172C] border-b border-[#1E3A5F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-[#C99A3D]/20 text-[#E2BD67] border border-[#C99A3D]/40 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {notifsList.length > 0 && (
              <button
                type="button"
                onClick={clearAllNotifications}
                className="text-xs text-slate-400 hover:text-[#E2BD67] transition-colors focus:outline-none focus-visible:underline"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#1E3A5F]/60">
            {notifsList.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No notifications at this time.
              </div>
            ) : (
              notifsList.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    markNotificationRead(n.id);
                    if (n.linkTarget) {
                      setCurrentPage(n.linkTarget);
                      setIsOpen(false);
                    }
                  }}
                  className={`p-3.5 transition-colors cursor-pointer flex gap-3 items-start ${
                    n.isRead ? 'bg-[#0B2748]/40 opacity-75' : 'bg-[#0B2748] hover:bg-[#132E52]'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">{getIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-semibold text-slate-100 truncate">{n.title}</h4>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{n.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2.5 bg-[#06172C] border-t border-[#1E3A5F] text-center">
            <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Secure End-to-End Client Communications</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
