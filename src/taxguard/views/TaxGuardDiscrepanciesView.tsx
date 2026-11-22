import React from 'react';

export interface TaxGuardDiscrepanciesViewProps {
  clientId?: string;
  taxYear?: number;
  discrepancies?: any[];
  onClose?: () => void;
  [key: string]: any;
}

export const TaxGuardDiscrepanciesView: React.FC<TaxGuardDiscrepanciesViewProps> = ({
  discrepancies = [],
}) => {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-[#0D2745] p-6 text-slate-100">
      <h3 className="text-lg font-semibold text-white">Document &amp; Return Discrepancies</h3>
      {discrepancies.length === 0 ? (
        <p className="mt-2 text-sm text-slate-300">
          No open discrepancies have been flagged for this engagement.
        </p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm">
          {discrepancies.map((item: any, idx: number) => (
            <li key={item?.id || idx} className="rounded-lg border border-slate-700/50 bg-[#071A2E] p-3">
              <div className="font-medium text-amber-300">{item?.title || item?.field || 'Discrepancy'}</div>
              <div className="mt-1 text-slate-300">{item?.description || item?.message || ''}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
