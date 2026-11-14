import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { initializeDatabase } from './server/db.ts';
import { apiRouter } from './server/routes.ts';

const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  initializeDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TableDesk server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
