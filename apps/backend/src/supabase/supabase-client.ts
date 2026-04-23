import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is required to initialize Supabase client');
}

if (!supabaseKey) {
  throw new Error(
    'SUPABASE_ANON_KEY or SUPABASE_KEY is required to initialize Supabase client',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
