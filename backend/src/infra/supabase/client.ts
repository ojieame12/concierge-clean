import { createClient } from '@supabase/supabase-js';

import { config } from '../../config';

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
};

export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  clientOptions
);

export const supabasePublic = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  clientOptions
);
