"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function OpsLogin() {
  const router = useRouter(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setError(""); const supabase = createBrowserSupabase(); if (!supabase) { setError("Supabase 환경변수가 필요해요."); setLoading(false); return; } const { error: authError } = await supabase.auth.signInWithPassword({ email, password }); setLoading(false); if (authError) { setError("이메일 또는 비밀번호를 확인해 주세요."); return; } router.replace("/ops"); router.refresh(); };
  return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}><form className="card" style={{ width: "min(100%, 420px)", padding: 32 }} onSubmit={submit}><div style={{ width: 64, height: 64, borderRadius: 20, display: "grid", placeItems: "center", background: "var(--brand-weak)", color: "var(--brand)", marginBottom: 24 }}><LockKeyhole/></div><h1 className="title-lg">서비스 운영자 로그인</h1><p className="body muted">사진관과 등록 기기를 관리하는 공급자 전용 화면이에요.</p><div style={{ display: "grid", gap: 18, margin: "26px 0" }}><label><span className="field-label">이메일</span><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label><span className="field-label">비밀번호</span><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label></div>{error && <p className="error-copy">{error}</p>}<button className="btn btn-primary btn-block" disabled={loading}>{loading ? "로그인 중..." : "로그인"}</button></form></main>;
}
