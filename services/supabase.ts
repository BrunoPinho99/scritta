import { createClient } from '@supabase/supabase-js';

// Usamos 'as any' para o TypeScript parar de reclamar do 'env'
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://exvwyiwiagpzoohtjyhh.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);