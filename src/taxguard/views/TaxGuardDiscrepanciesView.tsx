import React from 'react';

export interface TaxGuardDiscrepanciesViewProps {
  clientId?: string;
  taxYear?: number;
  discrepancies?: any[];
  [key: string]: any;
}

export const TaxGuardDiscrepanciesView: React.FC<TaxGuardDiscrepanciesViewProps> = ({
  taxYear = 2025,
  discrepancies = [],
}) => {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-[#0D2745] p-6 text-slate-100 space-y-3">
      <h3 className="text-base font-semibold text-white">
        Validation &amp; Discrepancy Review ({taxYear})
      </h3>
      {discrepancies.length === 0 ? (
        <p className="text-sm text-slate-300">
          No open data discrepancies are currently flagged for this tax year.
        </p>
      ) : (
        <ul className="space-y-2 text-sm text-slate-200">
          {discrepancies.map((item, idx) => (
            <li key={item?.id || idx} className="rounded-lg border border-slate-700/60 bg-[#06182B]/60 p-3">
              {item?.title || item?.description || 'Discrepancy item'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TaxGuardDiscrepanciesView;
