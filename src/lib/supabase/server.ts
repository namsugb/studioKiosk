import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createServerClient(url, key, { cookies: { getAll: () => cookieStore.getAll(), setAll: (values) => { try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} } } });
}

