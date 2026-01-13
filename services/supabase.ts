import { createClient } from '@supabase/supabase-js';

// ID CORRIGIDO (Baseado no seu print do Dashboard)
const supabaseUrl = 'https://exvwyiwiagpzoohtjyhh.supabase.co';

const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  ''; // Se tiver a chave anon, pode colar aqui entre aspas para testar rápido

export const supabase = createClient(supabaseUrl, supabaseAnonKey);