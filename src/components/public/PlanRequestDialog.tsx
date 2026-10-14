import React, { useEffect, useRef } from 'react';
import { CalendarCheck, Mail, X } from 'lucide-react';
import type { ServicePlan } from '../../types';

export const PRACTICE_CONTACT = { email: 'info@artaxservices.com', phone: '678-205-9486' } as const;

/**
 * Honest plan selection. No payment is taken on this website: plans are arranged with the practice
 * after a consultation, and no card or personal details are collected here.
 */
export function PlanRequestDialog({ plan, onClose, onRequestConsultation }: { plan: ServicePlan; onClose: () => void; onRequestConsultation: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  const subject = encodeURIComponent(`Plan enquiry: ${plan.name}`);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="plan-request-title" aria-describedby="plan-request-description"
        className="bg-[#0D2340] border border-[#C6A15B]/50 rounded-2xl max-w-lg w-full p-6 sm:p-8 text-slate-100 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#132E52]">
          <X aria-hidden="true" className="w-5 h-5" />
        </button>
        <div className="border-b border-[#1E3A5F] pb-3 pr-8">
          <p className="text-xs font-bold text-[#C6A15B] uppercase tracking-wider">Request this plan</p>
          <h3 id="plan-request-title" className="font-serif text-2xl font-bold text-white mt-1">{plan.name}</h3>
          <p className="text-xs text-slate-300 mt-1">Listed price: <strong className="text-white">${plan.price}</strong>{plan.billingPeriod === 'monthly' ? ' per month' : ' one-time'}</p>
        </div>
        <div id="plan-request-description" className="space-y-2 text-sm text-slate-300">
          <p>Online payment is not available on this website, and no card details are collected here.</p>
          <p>Your engagement, scope and final fee are agreed with the practice after a consultation. Nothing has been purchased or reserved.</p>
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onRequestConsultation} className="w-full py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] inline-flex items-center justify-center gap-2">
            <CalendarCheck aria-hidden="true" className="w-4 h-4" /> Request a consultation
          </button>
          <a href={`mailto:${PRACTICE_CONTACT.email}?subject=${subject}`} className="w-full py-3 rounded-xl font-bold text-xs text-slate-100 border border-[#1E3A5F] hover:border-[#C6A15B] inline-flex items-center justify-center gap-2">
            <Mail aria-hidden="true" className="w-4 h-4" /> E-mail the practice
          </a>
        </div>
      </div>
    </div>
  );
}
