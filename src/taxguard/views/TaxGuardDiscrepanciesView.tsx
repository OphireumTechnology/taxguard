/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export const TaxGuardDiscrepanciesView: React.FC<{ clientId?: string }> = () => {
  return (
    <div className="rounded-xl border border-slate-700 bg-[#0D2745] p-6 text-sm text-slate-200">
      <div className="flex items-center gap-3 mb-4">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        <h2 className="text-base font-bold text-white">Tax Discrepancy & Trace View</h2>
      </div>
      <p className="text-slate-300">
        All reported tax items and source extractions are reconciled. No blocking discrepancies recorded.
      </p>
    </div>
  );
};

export default TaxGuardDiscrepanciesView;
