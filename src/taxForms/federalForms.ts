
export interface FederalTaxForm {
  id: string;
  formNumber: string;
  title: string;
  group: string;
  preparation: string;
  category: string;
  taxYear: number;
  description: string;
  irsUrl?: string;
}

export const FEDERAL_FORMS: FederalTaxForm[] = [
  {
    id: "f1040",
    formNumber: "Form 1040",
    title: "U.S. Individual Income Tax Return",
    group: "federal-core",
    preparation: "E-FILE_READY",
    category: "INDIVIDUAL",
    taxYear: 2025,
    description: "Annual income tax return for individuals and sole proprietors."
  },
  {
    id: "f1120s",
    formNumber: "Form 1120-S",
    title: "U.S. Income Tax Return for an S Corporation",
    group: "federal-core",
    preparation: "E-FILE_READY",
    category: "CORPORATE",
    taxYear: 2025,
    description: "Tax return for electing small business corporations."
  },
  {
    id: "f1065",
    formNumber: "Form 1065",
    title: "U.S. Return of Partnership Income",
    group: "federal-core",
    preparation: "MAPPED",
    category: "PARTNERSHIP",
    taxYear: 2025,
    description: "Information return used by partnerships and multi-member LLCs."
  },
  {
    id: "f-sched-c",
    formNumber: "Schedule C",
    title: "Profit or Loss From Business (Sole Proprietorship)",
    group: "federal-schedules",
    preparation: "CALCULATED",
    category: "INDIVIDUAL",
    taxYear: 2025,
    description: "Income and deductible expenses for business operation."
  }
];
