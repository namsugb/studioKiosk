import { createAdminClient } from "@/lib/supabase/admin";

export type ActiveDevice = {
  id: string;
  store_id: string;
  organization_id: string;
  can_manage_catalog: boolean;
};

export function bearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
}

export async function resolveActiveDevice(token: string | null, deviceId: string | null) {
  if (!token || !deviceId) return null;
  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return null;

  let query = admin
    .from("devices")
    .select("id,store_id,organization_id,can_manage_catalog")
    .eq("auth_user_id", userData.user.id)
    .eq("active", true);
  query = query.eq("id", deviceId);

  const { data: device } = await query.single();
  if (!device) return null;
  return { admin, userId: userData.user.id, device: device as ActiveDevice };
}
