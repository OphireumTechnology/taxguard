import React from 'react';
import { CheckCircle2, ChevronRight, Clock } from 'lucide-react';

interface RecentActivityProps {
  onViewAll?: () => void;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ onViewAll }) => {
  const activities = [
    {
      id: 'act_1',
      title: 'Tax documents uploaded',
      subtitle: 'Form W-2 and 1099-NEC received into encrypted vault',
      timestamp: 'Today · 10:42 AM',
      type: 'completed'
    },
    {
      id: 'act_2',
      title: 'Accountant reviewed documents',
      subtitle: 'Desmond Hinds verified wage statements against IRS transcript',
      timestamp: 'Yesterday · 3:18 PM',
      type: 'completed'
    },
    {
      id: 'act_3',
      title: 'Engagement milestone completed',
      subtitle: 'Schedule C workpaper preparation marked complete',
      timestamp: 'Sep 11 · 9:04 AM',
      type: 'completed'
    },
    {
      id: 'act_4',
      title: 'Form 8879 prepared for review',
      subtitle: 'Electronic filing authorization queued for CPA certification',
      timestamp: 'Sep 10 · 11:30 AM',
      type: 'completed'
    }
  ];

  return (
    <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col justify-between space-y-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#183458] pb-3">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
              Audit Trail
            </span>
            <h3 className="font-serif text-base font-bold text-white">Recent Activity</h3>
          </div>
          <Clock className="w-4 h-4 text-slate-400" />
        </div>

        {/* Timeline list */}
        <div className="space-y-3">
          {activities.map((item) => (
            <div key={item.id} className="flex items-start gap-3 text-xs">
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{item.title}</div>
                <div className="text-[11px] text-slate-400 line-clamp-1">{item.subtitle}</div>
              </div>
              <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                {item.timestamp}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-[#183458]">
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-[#C6A15B] hover:text-[#D9BF7A] flex items-center gap-1"
        >
          <span>View all activity</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
