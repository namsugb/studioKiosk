"use client";
import { MonitorSmartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const normalizeLicense = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
const formatLicense = (value: string) => normalizeLicense(value).match(/.{1,4}/g)?.join("-") ?? "";

export function DeviceActivation() {
  const router = useRouter();
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activate = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError("");
    const headers: Record<string, string> = { "content-type": "application/json" };
    const supabase = createBrowserSupabase();
    if (supabase) {
      let { data } = await supabase.auth.getSession();
      if (!data.session) { const result = await supabase.auth.signInAnonymously(); data = { session: result.data.session }; }
      if (!data.session) { setError("기기 세션을 만들 수 없어요."); setLoading(false); return; }
      headers.authorization = `Bearer ${data.session.access_token}`;
    } else if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
      setError("Supabase 환경변수가 필요해요."); setLoading(false); return;
    }

    const response = await fetch("/api/device/activate", { method: "POST", headers, body: JSON.stringify({ licenseKey }) });
    const body = await response.json().catch(() => null); setLoading(false);
    if (!response.ok) { setError(body?.error ?? "기기 라이선스를 확인해 주세요."); return; }
    localStorage.setItem("studio-device-id", body.deviceId);
    localStorage.removeItem("studio-device-type");
    router.replace("/kiosk");
  };

  return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}><form className="card" style={{ width: "min(100%, 440px)", padding: 32 }} onSubmit={activate}><div style={{ width: 64, height: 64, borderRadius: 20, display: "grid", placeItems: "center", background: "var(--brand-weak)", color: "var(--brand)", marginBottom: 24 }}><MonitorSmartphone/></div><h1 className="title-lg">기기를 매장에 등록할게요</h1><p className="body muted">서비스 운영자가 제공한 기기 라이선스를 입력해 주세요.</p><label style={{ display: "block", margin: "26px 0 14px" }}><span className="field-label">기기 라이선스</span><input className="field" style={{ textTransform: "uppercase", letterSpacing: ".12em", fontSize: 22, textAlign: "center" }} value={licenseKey} maxLength={14} autoComplete="off" onChange={(event) => setLicenseKey(formatLicense(event.target.value))}/></label>{error && <p className="error-copy">{error}</p>}<button className="btn btn-primary btn-block" disabled={normalizeLicense(licenseKey).length !== 12 || loading}>{loading ? "등록 중..." : "기기 등록"}</button></form></main>;
}