import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requirePlatformUser() {
  const supabase = await createServerSupabase(); if (!supabase) return null; const { data } = await supabase.auth.getUser(); if (!data.user) return null;
  const admin = createAdminClient(); const { data: platformUser } = await admin.from("platform_users").select("id,role,active").eq("auth_user_id", data.user.id).eq("active", true).single();
  return platformUser ? { authUserId: data.user.id, ...platformUser } : null;
}
