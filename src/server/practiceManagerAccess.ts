import { practiceStoreConfigured } from './taxguard/practice/practiceStoreConfig';

// Durable practice-management endpoints a practice manager may call, only while the
// development-only durable routers are configured (never in production). Each router and the
// database re-verify manager authority, tenant and client scope, maker-checker and versions.
// Ledger (/api/bookkeeping), administration, security, e-file and payment-by-card routes stay
// closed to managers.
const ID = '[A-Za-z0-9_-]{1,128}';
const DURABLE_GET = new RegExp(`^/api/(practice/(my-work|summary)|practice/clients(/${ID})?|cases(/|/report|/${ID})?|vault/review-queue|vault/requests/(missing|review-queue)|vault/request-templates|vault/clients/${ID}/(upload-targets|documents(/${ID})?|requests|notifications)|billing/(catalog|ar-aging|clients/${ID}/invoices))$`);
const DURABLE_POST = new RegExp(`^/api/(` + [
  `practice/clients/${ID}/(status|type|engagements|engagements/${ID}/(status|tax-years|team)|team/${ID}/revoke|notes|tasks|tasks/${ID}/status|deadlines|deadlines/${ID}/resolve)`,
  `cases/?`, `cases/${ID}/(advance|return|hold|notes)`,
  `vault/clients/${ID}/documents`, `vault/clients/${ID}/documents/${ID}/versions/\\d{1,6}/(review|download)`, `vault/clients/${ID}/extractions/${ID}/verify`,
  `vault/request-templates`, `vault/clients/${ID}/requests`, `vault/clients/${ID}/requests/apply-template`, `vault/clients/${ID}/requests/${ID}/(link|waive|cancel|remind)`,
  `billing/catalog`, `billing/clients/${ID}/invoices`, `billing/clients/${ID}/invoices/${ID}/(lines|lines/\\d{1,4}/remove|submit|approve|return|void|payments|credits)`,
  `billing/clients/${ID}/payments/${ID}/refund`, `billing/clients/${ID}/credits/${ID}/(apply|reject)`,
].join('|') + `)$`);

export function practiceManagerRequestAllowed(role:string,method:string,url:string):boolean {
  if(role!=='practice_manager')return true;
  const path=url.split('?')[0];
  if ((method==='GET' && ['/api/operations/manager-dashboard','/api/auth/me','/api/auth/session'].includes(path)) || (method==='POST' && path==='/api/auth/logout')) return true;
  if (!practiceStoreConfigured()) return false;
  return (method === 'GET' && DURABLE_GET.test(path)) || (method === 'POST' && DURABLE_POST.test(path));
}
