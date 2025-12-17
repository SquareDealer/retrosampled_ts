// supabaseClient.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl) {
  console.error('Error: SUPABASE_URL is missing in environment variables.');
  console.error('Current process.env.SUPABASE_URL:', process.env.SUPABASE_URL);
  console.error('Current CWD:', process.cwd());
}

if (!supabaseKey) {
  console.error('Error: SUPABASE_ANON_KEY or SUPABASE_KEY is missing in environment variables.');
}

export const supabase = createClient(
  supabaseUrl!,
  supabaseKey!,
);
