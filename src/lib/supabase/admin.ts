import { createClient } from "@supabase/supabase-js";
import { assertServerConfiguration } from "@/lib/config";

export function createAdminClient() {
  assertServerConfiguration();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase admin environment is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}


