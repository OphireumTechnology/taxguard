import { onRequest } from 'firebase-functions/v2/https';

// Bundle generated from the existing server routes by the local predeploy build.
// Lazy loading ensures Firebase discovery never initializes application credentials.
let app: ReturnType<typeof require> | undefined;
export const taxguardApi = onRequest({
  region: 'us-central1',
  timeoutSeconds: 60,
  memory: '512MiB',
  maxInstances: 10,
  concurrency: 20,
  invoker: 'public',
  secrets: ['OPENAI_API_KEY'],
  cors: false,
}, (req, res) => {
  app ||= require('./taxguard-app.cjs').createProductionApp();
  app(req, res);
});
