export const hasSupabaseEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
export const hasSupabaseAdminEnv = hasSupabaseEnv && Boolean(process.env.SUPABASE_SECRET_KEY);
export const isDemoMode = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function assertServerConfiguration() {
  if (process.env.NODE_ENV === "production" && !hasSupabaseAdminEnv) throw new Error("Production Supabase configuration is missing");
  if (process.env.NODE_ENV === "production" && (!process.env.STAFF_SESSION_SECRET || process.env.STAFF_SESSION_SECRET.length < 32)) throw new Error("STAFF_SESSION_SECRET must contain at least 32 characters");
}


