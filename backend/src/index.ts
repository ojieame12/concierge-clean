import express from 'express';
import { createCorsMiddleware } from './middleware/cors';
import { config } from './config';
import { requireClientKey } from './middleware/require-client-key';
import { chatRouter } from './routes/chat';
import themeRouter from './routes/theme';
import { eventsRouter } from './routes/events';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(createCorsMiddleware({ origins: config.server.cors.origins }));

// Health check
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/chat', requireClientKey, chatRouter);
app.use('/api/events', requireClientKey, eventsRouter);
app.use('/theme', themeRouter);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Insite B2B API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/healthz`);
  console.log(`   Chat: http://localhost:${PORT}/api/chat`);
});

export default app;
