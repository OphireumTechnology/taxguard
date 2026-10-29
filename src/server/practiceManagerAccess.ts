import { practiceStoreConfigured } from './taxguard/practice/practiceStoreConfig';

// Durable practice-management endpoints a practice manager may call, only while the
// development-only durable routers are configured (never in production). Each router and the
// database re-verify manager authority, tenant and client scope, maker-checker and versions.
// Ledger (/api/bookkeeping), administration, security, e-file and payment-by-card routes stay
// closed to managers.
const ID = '[A-Za-z0-9_-]{1,128}';
const DURABLE_GET = new RegExp(`^/api/(practice/(my-work|summary)|practice/clients(/${ID})?|cases(/|/report|/${ID})?|vault/review-queue|vault/requests/(missing|review-queue)|vault/request-templates|vault/clients/${ID}/(upload-targets|documents(/${ID})?|requests|notifications)|billing/(catalog|ar-aging|clients/${ID}/invoices)|tax-engine/(sources|rule-sets(/${ID})?|rule-sets/${ID}/(tests|coverage)|form-rules(/${ID})?|return-templates(/${ID})?|cases/${ID}/(runs|research|diagnostics|risk|conclusions|conclusions/readiness|evidence-trace|form-mappings|returns|returns/stage-facts)|runs/${ID}/lineage|conclusions/${ID}/trace|form-mappings/${ID}|returns/${ID}|returns/${ID}/(verifications|risk))|communications/(inbox|clients/${ID}/threads(/${ID})?)|scheduling/(schedule|clients/${ID}/appointments(/${ID}(/room)?)?)|legal-matters/(disclaimer|clients/${ID}/matters)|consultations/requests|client-portal/clients/${ID}/engagements|reassignment/(queue|clients/${ID}/requests))$`);
const DURABLE_POST = new RegExp(`^/api/(` + [
  `practice/clients/${ID}/(status|type|engagements|engagements/${ID}/(status|tax-years|team)|team/${ID}/revoke|notes|tasks|tasks/${ID}/status|deadlines|deadlines/${ID}/resolve)`,
  `cases/?`, `cases/${ID}/(advance|return|hold|notes|team)`,
  `vault/clients/${ID}/documents`, `vault/clients/${ID}/documents/${ID}/versions/\\d{1,6}/(review|download)`, `vault/clients/${ID}/extractions/${ID}/verify`,
  `vault/request-templates`, `vault/clients/${ID}/requests`, `vault/clients/${ID}/requests/apply-template`, `vault/clients/${ID}/requests/${ID}/(link|waive|cancel|remind)`,
  `billing/catalog`, `billing/clients/${ID}/invoices`, `billing/clients/${ID}/invoices/${ID}/(lines|lines/\\d{1,4}/remove|submit|approve|return|void|payments|credits)`,
  `billing/clients/${ID}/payments/${ID}/refund`, `billing/clients/${ID}/credits/${ID}/(apply|reject)`,
  // Managers may register sources and draft / submit rule sets; verification and approval need a reviewer.
  `tax-engine/sources`, `tax-engine/rule-sets`, `tax-engine/rule-sets/${ID}/submit`,
  `tax-engine/rule-sets/${ID}/(tests|run-tests)`, `tax-engine/rule-sets/${ID}/tests/${ID}/remove`,
  // Managers may draft and submit form-mapping rules (Block 67); approval needs a reviewer and only the case preparer maps.
  `tax-engine/form-rules`, `tax-engine/form-rules/${ID}/submit`,
  // Managers may draft and submit return templates (Block 68); approval needs a reviewer, the case preparer prepares and
  // the case reviewer approves the return.
  `tax-engine/return-templates`, `tax-engine/return-templates/${ID}/submit`,
  // Managers may open, cite and submit case research; only the case's reviewer decides it.
  `tax-engine/cases/${ID}/research`, `tax-engine/research/${ID}/(citations|submit)`,
  // Case diagnostics and risk: the database lets a manager run, acknowledge INFO or WARNING findings and assess.
  `tax-engine/cases/${ID}/(diagnostics/run|risk)`, `tax-engine/diagnostics/${ID}/acknowledge`,
  // Client conversations (proposal 039): the database re-checks client scope and visibility.
  `communications/clients/${ID}/threads`, `communications/clients/${ID}/threads/${ID}/(messages|read|status)`,
  // Appointments (proposal 040): the database re-checks scope, staff eligibility and conflicts.
  `scheduling/clients/${ID}/appointments`, `scheduling/clients/${ID}/appointments/${ID}/(update|reschedule|status|room/join|room/leave)`,
  // Legal-coordination tracking (proposal 042): the database re-checks scope and the defined status order.
  `legal-matters/clients/${ID}/matters`, `legal-matters/clients/${ID}/matters/${ID}/(update|status|documents)`,
  // Consultation-request review (proposal 043): managers decide and convert; the database re-checks.
  `consultations/requests/${ID}/(decision|convert)`,
  // Reassignment-request review (proposal 045): leadership decides; reassignment stays a separate action.
  `reassignment/queue/${ID}/review`,
].join('|') + `)$`);

export function practiceManagerRequestAllowed(role:string,method:string,url:string):boolean {
  if(role!=='practice_manager')return true;
  const path=url.split('?')[0];
  // Same scoped, read-only billing authority as invoices; pagination does not grant mutations.
  if(method==='GET'&&new RegExp(`^/api/billing/clients/${ID}/invoice-pages$`).test(path))return practiceStoreConfigured();
  if(method==='GET'&&(/^\/api\/stage-two-three\/(questionnaire|requirements|requests)\/\d{4}$/.test(path)||new RegExp(`^/api/stage-two-three/requests/\\d{4}/${ID}$`).test(path)))return practiceStoreConfigured();
  if(method==='POST'&&new RegExp(`^/api/stage-two-three/requests/\\d{4}(/${ID}/resolve)?$`).test(path))return practiceStoreConfigured();
  if ((method==='GET' && ['/api/operations/manager-dashboard','/api/auth/me','/api/auth/session'].includes(path)) || (method==='POST' && path==='/api/auth/logout')) return true;
  if (!practiceStoreConfigured()) return false;
  // Stage 01 onboarding review (proposal 20261018030000): the database re-checks manager authority and scope.
  if (method === 'GET' && (path === '/api/stage-one/queue' || new RegExp(`^/api/stage-one/clients/${ID}$`).test(path))) return true;
  if (method === 'POST' && new RegExp(`^/api/stage-one/clients/${ID}/decision$`).test(path)) return true;
  return (method === 'GET' && DURABLE_GET.test(path)) || (method === 'POST' && DURABLE_POST.test(path));
}
