import { createBrowserClient } from "@supabase/ssr";
export function createBrowserSupabase() { const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_PUBLISHABLE_KEY; return url && key ? createBrowserClient(url, key) : null; }

