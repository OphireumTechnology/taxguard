import React from 'react';

interface AccountingCapabilityCardProps {
  title: string;
  description: string;
  supportingDetail: string;
  icon: React.ReactNode;
}

/**
 * Clean, high-readability accounting capability panel for QuickBooks Reporting,
 * Xero Ledger Management, and Account Reconciliation.
 * Contains no fabricated live sync indicators, transaction counts, or balances.
 */
export const AccountingCapabilityCard: React.FC<AccountingCapabilityCardProps> = ({
  title,
  description,
  supportingDetail,
  icon
}) => {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-[rgba(148,163,184,0.2)] bg-[#06182B]/90 p-5 transition-colors duration-200 hover:border-[rgba(212,168,67,0.48)]">
      <div>
        <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-lg border border-[rgba(212,168,67,0.28)] bg-[#0D2745]">
          {icon}
        </div>
        <h4 className="text-[15px] font-bold leading-snug text-white">
          {title}
        </h4>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
          {description}
        </p>
      </div>
      <p className="mt-3 border-t border-[rgba(148,163,184,0.14)] pt-2.5 text-xs font-medium text-slate-400">
        {supportingDetail}
      </p>
    </div>
  );
};
