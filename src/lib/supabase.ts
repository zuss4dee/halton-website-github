import { createClient } from '@supabase/supabase-js';
import WebSocket from 'isomorphic-ws';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== 'undefined', // Only persist in the browser
  },
  realtime: {
    transport: WebSocket, // This is the exact fix the stack trace requested
  },
  global: {
    WebSocket: WebSocket,
  }
});
