import { createBrowserSupabase } from "@/lib/supabase/browser";

export async function getOrCreateDeviceSession() {
  const supabase = createBrowserSupabase();
  if (!supabase) return { accessToken: null, deviceId: "demo-kiosk-device", deviceType: "kiosk", configured: false } as const;
  let { data } = await supabase.auth.getSession();
  if (!data.session) { const signed = await supabase.auth.signInAnonymously(); data = { session: signed.data.session }; }
  return { accessToken: data.session?.access_token ?? null, deviceId: localStorage.getItem("studio-device-id"), deviceType: localStorage.getItem("studio-device-type"), configured: true };
}
