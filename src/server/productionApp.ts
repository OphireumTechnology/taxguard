import express from 'express';

export function createProductionApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      firm: 'DESTRIA TAX SERVICES LLC',
      location: 'Columbia, South Carolina, USA',
      founder: 'Desmond Hinds',
      serverTime: new Date().toISOString(),
    });
  });

  return app;
}
