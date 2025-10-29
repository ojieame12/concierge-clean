import type { RequestHandler } from 'express';

export interface CorsOptions {
  origins: string[];
  allowCredentials?: boolean;
  implicitOrigins?: string[];
}

const extractOrigin = (value: string | undefined | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
};

const sanitizeOrigin = (origin: string) => origin.trim();

export const createCorsMiddleware = ({
  origins,
  allowCredentials = true,
  implicitOrigins = [],
}: CorsOptions): RequestHandler => {
  const configuredOrigins = origins.map(sanitizeOrigin).filter(Boolean);
  const derivedOrigins = implicitOrigins
    .map(extractOrigin)
    .filter((value): value is string => Boolean(value));

  const allowedOrigins = new Set([...configuredOrigins, ...derivedOrigins]);
  const allowWildcard = allowedOrigins.has('*');

  return (req, res, next) => {
    const requestOrigin = req.headers.origin;

    if (!requestOrigin) {
      next();
      return;
    }

    const isAllowed = allowWildcard || allowedOrigins.has(requestOrigin);

    if (!isAllowed) {
      if (req.method === 'OPTIONS') {
        res.sendStatus(403);
        return;
      }
      res.status(403).json({ error: 'Origin not allowed' });
      return;
    }

    res.header('Access-Control-Allow-Origin', requestOrigin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-concierge-client-key, x-concierge-admin-key');

    if (allowCredentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  };
};
