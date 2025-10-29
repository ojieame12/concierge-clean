import type { RequestHandler } from 'express';

import { config } from '../config';

const clientKeys = new Set(config.security.clientApiKeys);

export const requireClientKey: RequestHandler = (req, res, next) => {
  if (!clientKeys.size) {
    res.status(503).json({ error: 'Client authentication not configured' });
    return;
  }

  const header = req.header('x-concierge-client-key');
  if (header && clientKeys.has(header)) {
    next();
    return;
  }

  res.status(401).json({ error: 'Invalid client key' });
};
