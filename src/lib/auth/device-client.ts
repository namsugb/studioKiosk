import { createBrowserSupabase } from "@/lib/supabase/browser";

export async function getOrCreateDeviceSession() {
  if (process.env.NODE_ENV === "development") return { accessToken: null, deviceId: "dev-device", configured: false } as const;
  const supabase = createBrowserSupabase();
  if (!supabase) return { accessToken: null, deviceId: "demo-device", configured: false } as const;
  let { data } = await supabase.auth.getSession();
  if (!data.session) { const signed = await supabase.auth.signInAnonymously(); data = { session: signed.data.session }; }
  return { accessToken: data.session?.access_token ?? null, deviceId: localStorage.getItem("studio-device-id"), configured: true };
}