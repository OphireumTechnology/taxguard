import React, { useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle, FileText, Calendar, ShieldCheck } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export const NotificationsView: React.FC = () => {
  const { notifications } = useApp();
  const [readIds, setReadIds] = useState<{ [id: string]: boolean }>({});

  const toggleRead = (id: string) => {
    setReadIds(prev => ({ ...prev, [id]: true }));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <FileText className="w-4 h-4 text-[#C6A15B]" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'success':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-[#C6A15B]" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="p-6 sm:p-7 rounded-2xl bg-[#0A1F38] border border-[#183458] shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
            System Alerts &amp; Audit Notifications
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mt-1">
            Notifications Center
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Real-time status updates regarding document verification, preparation milestones, and advisor inquiries.
          </p>
        </div>

        <span className="text-xs text-slate-400">
          Total Notifications: <strong>{notifications.length}</strong>
        </span>
      </div>

      {/* Notifications List */}
      <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            No unread notifications at this time.
          </div>
        ) : (
          notifications.map((notif) => {
            const isRead = notif.isRead || notif.read || readIds[notif.id];

            return (
              <div
                key={notif.id}
                onClick={() => toggleRead(notif.id)}
                className={`p-4 rounded-xl border flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                  isRead
                    ? 'bg-[#06172C] border-[#183458] opacity-75'
                    : 'bg-[#0D2340] border-[#C6A15B]/30 hover:border-[#C6A15B]/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#06172C] border border-[#183458] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getIcon(notif.type)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-white">{notif.title}</h4>
                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#C6A15B]" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      {new Date(notif.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {!isRead && (
                  <span className="text-[10px] text-[#C6A15B] font-semibold flex-shrink-0">
                    Mark Read
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

