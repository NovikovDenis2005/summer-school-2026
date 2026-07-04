import express from 'express';
import cors from 'cors';
import { router } from './http/routes.js';

/** Сборка Express-приложения (используется и dev-сервером, и тестами). */
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', router);
  return app;
}
