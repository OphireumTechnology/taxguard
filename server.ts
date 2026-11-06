import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';

function resolvePort(): number {
  const portIndex = process.argv.indexOf('--port');
  if (portIndex !== -1 && process.argv[portIndex + 1]) {
    return Number(process.argv[portIndex + 1]);
  }
  if (process.env.APP_PORT) {
    return Number(process.env.APP_PORT);
  }
  return 3000;
}
const PORT = resolvePort();
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security & CORS Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Health checks
app.get('/health', (_req, res) => res.json({ status: 'healthy', uptime: process.uptime() }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'DESTRIA TAX SERVICES LLC' }));

// Tax Forms Catalog
app.get('/api/tax-forms', (_req, res) => {
  res.json({
    federalForms: [
      { id: '1040', formNumber: '1040', officialName: 'U.S. Individual Income Tax Return', groups: ['individual-1040'], taxYears: [2024, 2025], readiness: 'E-File Verified', schedules: ['Schedule A', 'Schedule B', 'Schedule C', 'Schedule D', 'Schedule E', 'Schedule SE'] },
      { id: '1120s', formNumber: '1120-S', officialName: 'U.S. Income Tax Return for an S Corporation', groups: ['s-corporations-1120s'], taxYears: [2024, 2025], readiness: 'E-File Verified', schedules: ['Schedule K-1', 'Form 1125-A', 'Form 8825'] },
      { id: '1065', formNumber: '1065', officialName: 'U.S. Return of Partnership Income', groups: ['partnerships-1065'], taxYears: [2024, 2025], readiness: 'Calculation Certified', schedules: ['Schedule K-1', 'Form 8825'] },
      { id: '1120', formNumber: '1120', officialName: 'U.S. Corporation Income Tax Return', groups: ['c-corporations-1120'], taxYears: [2024, 2025], readiness: 'Field Mapped', schedules: ['Schedule G', 'Schedule J'] }
    ],
    states: [
      { code: 'SC', name: 'South Carolina', agencyName: 'South Carolina Department of Revenue', categories: { 'individual-income': { applicability: 'applies' }, 'corporate-income': { applicability: 'applies' }, 'pass-through-entity': { applicability: 'applies' }, 'sales-and-use': { applicability: 'applies' }, 'franchise-tax': { applicability: 'applies' } } },
      { code: 'NC', name: 'North Carolina', agencyName: 'North Carolina Department of Revenue', categories: { 'individual-income': { applicability: 'applies' }, 'corporate-income': { applicability: 'applies' }, 'pass-through-entity': { applicability: 'applies' }, 'sales-and-use': { applicability: 'applies' }, 'franchise-tax': { applicability: 'applies' } } },
      { code: 'GA', name: 'Georgia', agencyName: 'Georgia Department of Revenue', categories: { 'individual-income': { applicability: 'applies' }, 'corporate-income': { applicability: 'applies' }, 'pass-through-entity': { applicability: 'applies' }, 'sales-and-use': { applicability: 'applies' }, 'franchise-tax': { applicability: 'applies' } } }
    ],
    groups: [
      { id: 'individual-1040', label: 'Form 1040 Individual' },
      { id: 's-corporations-1120s', label: 'Form 1120-S S-Corporation' },
      { id: 'partnerships-1065', label: 'Form 1065 Partnership' },
      { id: 'c-corporations-1120', label: 'Form 1120 C-Corporation' }
    ],
    coreCategories: [
      { id: 'individual-1040', label: 'Individual Income Tax' },
      { id: 's-corporations-1120s', label: 'S-Corporation Returns' }
    ]
  });
});

// Staff Access Directory & Management
app.get('/api/staff-access/directory', (_req, res) => {
  res.json({
    items: [
      { uid: 'usr_staff_desmond', email: 'dhinds@destriatax.com', name: 'Desmond Hinds', role: 'accountant', status: 'active', mfaEnrolled: true },
      { uid: 'usr_staff_elena', email: 'erostova@destriatax.com', name: 'Elena Rostova, CPA', role: 'senior_reviewer', status: 'active', mfaEnrolled: true },
      { uid: 'usr_staff_marcus', email: 'mvance@destriatax.com', name: 'Marcus Vance', role: 'accountant', status: 'active', mfaEnrolled: true },
      { uid: 'usr_staff_admin', email: 'admin@destriatax.com', name: 'Victoria Reynolds', role: 'admin', status: 'active', mfaEnrolled: true }
    ],
    total: 4,
    page: 1,
    pageSize: 50
  });
});

app.get('/api/staff-access/sessions', (_req, res) => res.json([]));
app.get('/api/staff-access/mfa-recovery-queue', (_req, res) => res.json({ items: [], nextCursor: null, source: 'durable' }));

// Client Portal & Dashboard Data
app.get('/api/client-portal/overview', (_req, res) => {
  res.json({
    engagements: [],
    documents: [],
    appointments: [],
    invoices: []
  });
});

// Unimplemented APIs must never confirm a mutation or security operation.
app.all('/api/*', (req, res) => {
  res.status(501).json({ success: false, code: 'API_NOT_IMPLEMENTED', message: 'This API operation is unavailable.' });
});

// Serve Public Static Assets
app.use(express.static(path.resolve(process.cwd(), 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: 'spa'
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[DESTRIA TAX SERVICES LLC] Dev server initialized on http://0.0.0.0:${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down server...`);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
