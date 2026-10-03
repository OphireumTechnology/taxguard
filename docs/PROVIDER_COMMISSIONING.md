# TaxGuard AI — External Provider Commissioning Guide
**Firm:** A/R Tax Services, LLC  
**Application:** TaxGuard AI Operations Engine  
**Policy:** Zero Mocking in Production — Unconfigured Providers Fail Closed Truthfully  

---

## 1. Provider Status Matrix

| Provider / Capability | Software Status | Deployment Prerequisite | Human Authorization |
| :--- | :--- | :--- | :--- |
| **Supabase (PostgreSQL & Auth)** | `SOFTWARE_READY` | `CONFIGURATION_REQUIRED` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) | Database Administrator approval |
| **OpenAI AI Reasoning** | `SOFTWARE_READY` | `CONFIGURATION_REQUIRED` (`OPENAI_API_KEY`, `OPENAI_MODEL`) | Managing Partner policy sign-off |
| **Malware Scanner (Daemon/API)** | `SOFTWARE_READY` | `PROVIDER_COMMISSIONING_REQUIRED` (`TAXGUARD_MALWARE_SCANNER_ENABLED`) | Practice Security Officer |
| **Document OCR Engine** | `SOFTWARE_READY` | `CONFIGURATION_REQUIRED` (`DOCUMENT_AI_PROCESSOR_ID` or Vision API) | Operations Director |
| **QuickBooks Online OAuth** | `SOFTWARE_READY` | `PROVIDER_COMMISSIONING_REQUIRED` (Intuit Developer App Keys) | Client explicit consent & credentials |
| **Xero Accounting OAuth** | `SOFTWARE_READY` | `PROVIDER_COMMISSIONING_REQUIRED` (Xero App Client ID/Secret) | Client explicit consent & credentials |
| **Stripe Payment Gateway** | `SOFTWARE_READY` | `CONFIGURATION_REQUIRED` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) | Managing Partner banking authorization |
| **Email Gateway (SendGrid/SMTP)**| `SOFTWARE_READY` | `CONFIGURATION_REQUIRED` (`SENDGRID_API_KEY` or SMTP host) | Practice Operations |
| **SMS Gateway (Twilio)** | `SOFTWARE_READY` | `CONFIGURATION_REQUIRED` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) | Practice Operations |
| **E-Signature (DocuSign/HelloSign)** | `SOFTWARE_READY` | `PROVIDER_COMMISSIONING_REQUIRED` (E-Sign API credentials) | Senior CPA / Authorized Signatory |
| **IRS MeF E-File Transmitter** | `SOFTWARE_READY` | `PROVIDER_COMMISSIONING_REQUIRED` (Authorized ETIN & EFIN verification) | Managing Partner (Desmond Hinds, EA/CPA) |
| **State Tax Filing Gateways** | `SOFTWARE_READY` | `PROVIDER_COMMISSIONING_REQUIRED` (State DOR transmitter credentials) | Senior Signatory CPA |

---

## 2. Commissioning Step-by-Step

### 2.1 Supabase Relational Database & Authentication
1. Provision Supabase production project in preferred region (US East / AWS N. Virginia).
2. Execute migration chain:
   ```bash
   supabase db push
   ```
3. Set environment variables on host:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `TAXGUARD_TENANT_ID=ar-tax-services`
4. Verify schema readiness:
   ```bash
   node scripts/verify-post-restore.mjs
   ```

### 2.2 OpenAI Advisory Intelligence
1. Create organization API key within OpenAI platform.
2. Configure `OPENAI_API_KEY` and optional `OPENAI_MODEL=gpt-4o`.
3. Enable case advisory flag: `TAXGUARD_OPENAI_CASES_ENABLED=true`.
4. Verify `/api/taxguard-ai/health` returns `configured: true`.

### 2.3 Stripe Payments
1. Configure Stripe webhook endpoint: `https://artaxserv.com/api/payments/webhook`.
2. Select webhook events: `payment_intent.succeeded`, `charge.refunded`, `invoice.payment_succeeded`.
3. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on server.

### 2.4 Accounting Integrations (QuickBooks & Xero)
1. Register developer application on Intuit Developer portal and Xero Developer portal.
2. Add authorized redirect URIs:
   - `https://artaxserv.com/api/integrations/quickbooks/callback`
   - `https://artaxserv.com/api/integrations/xero/callback`
3. Populate client IDs and secrets in production host environment.

### 2.5 Stage 11 E-Signature & Stage 12 IRS Filing
1. **IRS Transmitter Readiness:** IRS MeF transmission requires a certified Electronic Return Originator (ERO) status and an Electronic Transmitter Identification Number (ETIN).
2. Configure `TAXGUARD_IRS_MEF_TRANSMITTER_ID` and `TAXGUARD_MEF_ETIN`.
3. Until official credentials are provisioned, Stages 11 and 12 remain safely blocked in software, protecting the firm and taxpayers from accidental or uncertified transmissions.
