import { collection, doc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export const INITIAL_SERVICES_SEED = [
  {
    id: 'srv_individual_1040',
    title: 'Individual & Family Wealth Tax Filing',
    description: 'Comprehensive preparation of Form 1040, Schedule A/B/C/D, multi-state allocations, and dividend/capital gains optimization.',
    category: 'tax_prep',
    priceMonthly: 0,
    priceAnnual: 45000, // $450.00
    active: true
  },
  {
    id: 'srv_business_entity',
    title: 'Small Business Tax Optimization (1120-S / 1065)',
    description: 'Expert filing for S-Corporations, Partnerships, and LLCs. Maximizes QBI deductions, shareholder basis tracking, and depreciation schedules.',
    category: 'tax_prep',
    priceMonthly: 0,
    priceAnnual: 125000, // $1,250.00
    active: true
  },
  {
    id: 'srv_corporate_advisory',
    title: 'Corporate & Multi-State Tax Advisory',
    description: 'Strategic tax structure planning, nexus evaluation, consolidated return analysis, and year-round corporate advisory.',
    category: 'tax_planning',
    priceMonthly: 0,
    priceAnnual: 250000, // $2,500.00
    active: true
  },
  {
    id: 'srv_quarterly_planning',
    title: 'Quarterly Estimated Tax Planning & Safe Harbor',
    description: 'Proactive quarterly calculations, voucher generation, safe harbor penalty avoidance, and cash flow optimization.',
    category: 'tax_planning',
    priceMonthly: 15000, // $150.00
    priceAnnual: 60000,
    active: true
  },
  {
    id: 'srv_bookkeeping_advisory',
    title: 'Full-Service Bookkeeping & Financial Reporting',
    description: 'Monthly ledger reconciliation, balance sheet management, P&L reporting, and direct integration with QuickBooks & Xero.',
    category: 'bookkeeping',
    priceMonthly: 35000, // $350.00
    priceAnnual: 420000,
    active: true
  },
  {
    id: 'srv_irs_audit_defense',
    title: 'IRS Notice Resolution & Audit Representation',
    description: 'Formal CPA representation before the Internal Revenue Service and state departments of revenue for audit defense and penalty abatement.',
    category: 'audit_defense',
    priceMonthly: 0,
    priceAnnual: 150000, // $1,500.00
    active: true
  }
];

export async function seedInitialServicesIfEmpty(): Promise<void> {
  try {
    const servicesSnap = await getDocs(collection(db, 'services'));
    if (servicesSnap.empty) {
      console.log('[Seed] Populating initial professional services catalog into Firestore...');
      for (const srv of INITIAL_SERVICES_SEED) {
        await setDoc(doc(db, 'services', srv.id), {
          ...srv,
          createdAt: serverTimestamp()
        });
      }
      console.log('[Seed] Services catalog populated successfully.');
    }
  } catch (err) {
    console.warn('[Seed] Notice during services check:', err);
  }
}
