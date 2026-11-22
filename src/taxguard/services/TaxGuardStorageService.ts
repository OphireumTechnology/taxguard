import type { TaxGuardDiscrepancy } from '../types';

const initialDiscrepancies: TaxGuardDiscrepancy[] = [
  {
    id: 'disc_001',
    clientId: 'client_henze_001',
    ruleCode: 'QC-1099-04',
    title: '1099-NEC Reported Total vs. Ledger Deposit Variance',
    taxYear: 2025,
    neutralDescription:
      'Combined Form 1099-NEC nonemployee compensation differs from business deposit ledger totals pending year-end timing verification.',
    status: 'open',
    severity: 'medium',
    affectedDocuments: ['Form 1099-NEC', 'Business Operating Ledger'],
    recommendedAction: 'Confirm whether December client retainage cleared in January and document timing tie-out.',
  },
];

let discrepanciesStore: TaxGuardDiscrepancy[] = initialDiscrepancies.map((item) => ({ ...item }));

export const TaxGuardStorageService = {
  getDiscrepancies(_userRole: string, clientId?: string): TaxGuardDiscrepancy[] {
    if (!clientId) return discrepanciesStore.map((d) => ({ ...d }));
    return discrepanciesStore.filter((d) => !d.clientId || d.clientId === clientId).map((d) => ({ ...d }));
  },

  resolveDiscrepancy(id: string, reviewedBy: string, reviewerNotes: string): void {
    discrepanciesStore = discrepanciesStore.map((d) =>
      d.id === id
        ? {
            ...d,
            status: 'resolved',
            reviewedBy,
            reviewerNotes,
            resolvedAt: new Date().toISOString(),
          }
        : d
    );
  },
};
