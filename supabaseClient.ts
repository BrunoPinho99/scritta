
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://exvwyiwiagpzoohtjyhh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dnd5aXdpYWdwem9vaHRqeWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMDIwOTIsImV4cCI6MjA4MTY3ODA5Mn0.5BrifF-sHUQx24ecH_YqhSnbwsHPY62vNtP9OAH_h3c';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
