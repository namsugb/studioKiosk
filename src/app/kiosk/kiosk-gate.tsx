"use client";
import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { useEffect, useState } from "react";
import type { Catalog } from "@/lib/catalog/schema";
import { getOrCreateDeviceSession } from "@/lib/auth/device-client";
import { cacheCatalog, getCachedCatalog } from "@/lib/offline/db";
import { KioskApp } from "./kiosk-app";

type GateState = {
  loading: boolean;
  catalog: Catalog;
  accessToken: string | null;
  deviceId: string | null;
  needsActivation: boolean;
};

export function KioskGate({ initialCatalog }: { initialCatalog: Catalog }) {
  const [state, setState] = useState<GateState>({ loading: true, catalog: initialCatalog, accessToken: null, deviceId: null, needsActivation: false });
  useEffect(() => { (async () => {
    const session = await getOrCreateDeviceSession();
    if (!session.configured) { setState({ loading: false, catalog: initialCatalog, accessToken: null, deviceId: session.deviceId, needsActivation: false }); return; }
    if (!session.accessToken || !session.deviceId) { setState((value) => ({ ...value, loading: false, needsActivation: true })); return; }
    try {
      const response = await fetch("/api/catalog/current", { headers: { authorization: `Bearer ${session.accessToken}`, "x-device-id": session.deviceId }, cache: "no-store" });
      if (!response.ok) throw new Error("catalog");
      const catalog = await response.json();
      await cacheCatalog(catalog);
      setState({ loading: false, catalog, accessToken: session.accessToken, deviceId: session.deviceId, needsActivation: false });
    } catch {
      const cached = await getCachedCatalog();
      setState({ loading: false, catalog: cached ?? initialCatalog, accessToken: session.accessToken, deviceId: session.deviceId, needsActivation: false });
    }
  })(); }, [initialCatalog]);
  if (state.loading) return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><p className="muted">키오스크를 준비하고 있어요...</p></main>;
  if (state.needsActivation) return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}><div className="card" style={{ width: "min(100%, 440px)", padding: 32, textAlign: "center" }}><div style={{ width: 68, height: 68, display: "grid", placeItems: "center", margin: "0 auto 22px", borderRadius: 20, color: "var(--brand)", background: "var(--brand-weak)" }}><MonitorSmartphone/></div><h1 className="title-lg">기기 등록이 필요해요</h1><p className="body muted">운영자가 제공한 라이선스로 이 기기를 매장에 등록해 주세요.</p><Link className="btn btn-primary" style={{ display: "grid", placeItems: "center", marginTop: 24 }} href="/activate">기기 등록하기</Link></div></main>;
  return <KioskApp initialCatalog={state.catalog} accessToken={state.accessToken} deviceId={state.deviceId}/>;
}