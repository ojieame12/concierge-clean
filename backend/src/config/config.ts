import 'dotenv/config';

const requireEnv = (key: string) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const parseList = (value?: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const parseScopes = (scopesRaw: string) => parseList(scopesRaw);

const toPositiveInteger = (rawValue: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

export const config = {
  port: Number(process.env.PORT ?? 4000),
  supabase: {
    url: requireEnv('SUPABASE_URL'),
    anonKey: requireEnv('SUPABASE_ANON_KEY'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  },
  database: {
    connectionString: requireEnv('SUPABASE_DB_URL'),
  },
  shopify: {
    apiKey: requireEnv('SHOPIFY_API_KEY'),
    apiSecret: requireEnv('SHOPIFY_API_SECRET'),
    scopes: parseScopes(requireEnv('SHOPIFY_SCOPES')),
    appUrl: requireEnv('SHOPIFY_APP_URL'),
    apiVersion: process.env.SHOPIFY_API_VERSION ?? '2024-10',
  },
  google: {
    apiKey: requireEnv('GOOGLE_AI_API_KEY'),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY, // Optional
  },
  featureFlags: {
    verticalPacks: process.env.ENABLE_VERTICAL_PACKS === 'true',
  },
  tools: {
    baseUrl: process.env.TOOLS_BASE_URL,
  },
  catalogSync: {
    apiKeys: parseList(process.env.CATALOG_SYNC_API_KEYS),
  },
  security: {
    clientApiKeys: parseList(process.env.CLIENT_API_KEYS),
  },
  admin: {
    apiKey: process.env.ADMIN_API_KEY || null,
  },
  frontend: {
    bundleUrl: process.env.FRONTEND_BUNDLE_URL || 'https://cdn.insiteconcierge.com/concierge-page.js',
    stylesheetUrl: process.env.FRONTEND_STYLESHEET_URL || null,
    widgetUrl: process.env.FRONTEND_WIDGET_URL || 'https://cdn.insiteconcierge.com/concierge-widget.js',
  },
  server: {
    cors: {
      origins: parseList(process.env.CORS_ORIGINS),
    },
    rateLimit: {
      windowMs: toPositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
      max: toPositiveInteger(process.env.RATE_LIMIT_MAX, 120),
    },
  },
  chat: {
    maxMessages: toPositiveInteger(process.env.CHAT_MAX_MESSAGES, 40),
    maxMessageLength: toPositiveInteger(process.env.CHAT_MAX_MESSAGE_LENGTH, 2000),
    maxTotalChars: toPositiveInteger(process.env.CHAT_MAX_TOTAL_CHARS, 8000),
    sessionIdMaxLength: toPositiveInteger(process.env.CHAT_SESSION_ID_MAX_LENGTH, 128),
  },
};
