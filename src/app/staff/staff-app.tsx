"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bell, BellOff, LayoutList, LockKeyhole, LogOut, MonitorSmartphone, Package, RotateCcw, Settings, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOrCreateDeviceSession } from "@/lib/auth/device-client";
import { defaultCatalog } from "@/lib/catalog/defaults";
import { formatWon } from "@/lib/catalog/calculate";
import type { IntakeRecord, IntakeStatus } from "@/lib/intakes/types";
import { statusLabels, statusNext } from "@/lib/intakes/types";
import styles from "./staff.module.css";
import { CatalogEditor } from "./catalog-editor";
import { IntakeEditor } from "./intake-editor";

type View = "intakes" | "catalog" | "settings";
type DeviceSession = { accessToken: string | null; deviceId: string; configured: boolean };
const badges: Record<IntakeStatus,string> = { pending_review: "badge-orange", waiting_shoot: "badge-blue", shooting: "badge-blue", payment_waiting: "badge-orange", completed: "badge-green", cancelled: "badge-red" };

export function StaffApp() {
  const router = useRouter();
  const [preparing, setPreparing] = useState(true); const [needsActivation, setNeedsActivation] = useState(false); const [deviceSession, setDeviceSession] = useState<DeviceSession | null>(null);
  const [unlocked, setUnlocked] = useState(false); const [pin, setPin] = useState(""); const [error, setError] = useState("");
  const [view, setView] = useState<View>("intakes"); const [intakes, setIntakes] = useState<IntakeRecord[]>([]); const [filter, setFilter] = useState<IntakeStatus | "all">("all");
  const [selected, setSelected] = useState<IntakeRecord | null>(null); const [muted, setMuted] = useState(false); const knownIds = useRef(new Set<string>());
  const [loading, setLoading] = useState(false); const [canManageCatalog, setCanManageCatalog] = useState(false);

  const beep = useCallback(() => { if (muted) return; const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AudioContextClass) return; const ctx = new AudioContextClass(); const oscillator = ctx.createOscillator(); const gain = ctx.createGain(); oscillator.frequency.value = 720; gain.gain.setValueAtTime(.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .16); oscillator.connect(gain).connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + .16); }, [muted]);
  const load = useCallback(async (notify = false) => { const response = await fetch("/api/staff/intakes", { cache: "no-store" }); if (response.status === 401) { setUnlocked(false); return; } if (!response.ok) return; const data = await response.json(); const rows: IntakeRecord[] = data.intakes; if (notify && rows.some((row) => !knownIds.current.has(row.id))) beep(); rows.forEach((row) => knownIds.current.add(row.id)); setIntakes(rows); }, [beep]);

  useEffect(() => {
    let active = true;
    (async () => {
      await fetch("/api/staff/lock", { method: "POST" }).catch(() => undefined);
      const session = await getOrCreateDeviceSession();
      if (!active) return;
      if (session.configured && (!session.accessToken || !session.deviceId)) { setNeedsActivation(true); setPreparing(false); return; }
      setDeviceSession({ accessToken: session.accessToken, deviceId: session.deviceId ?? "demo-device", configured: session.configured });
      setPreparing(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    const initialLoad = window.setTimeout(() => load(), 0);
    const timer = window.setInterval(() => load(true), 10000);
    const reconnect = () => load(true); window.addEventListener("online", reconnect);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); window.removeEventListener("online", reconnect); };
  }, [unlocked, load]);

  const unlock = async () => {
    if (!deviceSession) return;
    setLoading(true); setError("");
    const headers: Record<string,string> = { "content-type": "application/json" };
    if (deviceSession.accessToken) headers.authorization = `Bearer ${deviceSession.accessToken}`;
    const response = await fetch("/api/staff/unlock", { method: "POST", headers, body: JSON.stringify({ pin, deviceId: deviceSession.deviceId }) });
    const body = await response.json().catch(() => null); setLoading(false);
    if (!response.ok) { if (body?.code === "DEVICE_NOT_REGISTERED") setNeedsActivation(true); setError(body?.error ?? "잠금을 풀 수 없어요."); return; }
    setCanManageCatalog(body.canManageCatalog === true); setUnlocked(true); setPin(""); beep();
  };
  const lock = async () => { await fetch("/api/staff/lock", { method: "POST" }); setUnlocked(false); setCanManageCatalog(false); setIntakes([]); setSelected(null); router.replace("/kiosk"); };
  const changeStatus = async (item: IntakeRecord, status: IntakeStatus) => { const response = await fetch(`/api/staff/intakes/${item.id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }); if (response.ok) { const updated = await response.json(); setIntakes((rows) => rows.map((row) => row.id === item.id ? updated : row)); setSelected(updated); } };
  const visible = useMemo(() => filter === "all" ? intakes : intakes.filter((item) => item.status === filter), [filter, intakes]);
  const count = (status: IntakeStatus) => intakes.filter((item) => item.status === status).length;

  if (preparing) return <main className={styles.lock}><p className="muted">직원 화면을 준비하고 있어요...</p></main>;
  if (needsActivation) return <main className={styles.lock}><div className={styles.lockStack}><div className={styles.lockCard}><div className={styles.lockIcon}><MonitorSmartphone /></div><h1 className="title-lg">기기 등록이 필요해요</h1><p className="body muted">운영자가 제공한 라이선스로 이 기기를 먼저 등록해 주세요.</p><Link className="btn btn-primary btn-block" href="/activate" style={{ marginTop: 24 }}>기기 등록하기</Link></div><Link className={`btn btn-secondary ${styles.backLink}`} href="/kiosk">접수 화면으로 돌아가기</Link></div></main>
  if (!unlocked) return <main className={styles.lock}><div className={styles.lockStack}><form className={styles.lockCard} onSubmit={(event) => { event.preventDefault(); unlock(); }}><div className={styles.lockIcon}><LockKeyhole /></div><h1 className="title-lg">직원 화면 잠금</h1><p className="body muted">매장 공용 PIN을 입력해 주세요.</p><label style={{ display: "block", margin: "26px 0 14px" }}><span className="field-label">매장 PIN</span><input className={`field ${styles.pin}`} type="password" inputMode="numeric" maxLength={8} autoFocus value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g,""))} /></label>{error && <p className="error-copy">{error}</p>}<button className="btn btn-primary btn-block" disabled={pin.length < 4 || loading}>{loading ? "확인 중..." : "직원 화면 열기"}</button></form><Link className={`btn btn-secondary ${styles.backLink}`} href="/kiosk">접수 화면으로 돌아가기</Link></div></main>
  return <div className="admin-shell"><aside className="sidebar"><div className="brand">나다움 직원</div><div className="caption tertiary" style={{ marginTop: 5 }}>순천 본점</div><nav className="sidebar-nav"><button className={`sidebar-link ${view === "intakes" ? "active" : ""}`} onClick={() => setView("intakes")}><LayoutList size={18}/>오늘의 접수</button>{canManageCatalog && <button className={`sidebar-link ${view === "catalog" ? "active" : ""}`} onClick={() => setView("catalog")}><Package size={18}/>상품 관리</button>}<button className={`sidebar-link ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><Settings size={18}/>키오스크 설정</button></nav><div className={styles.navFooter}><button className="sidebar-link" onClick={lock}><LogOut size={18}/>화면 잠그기</button></div></aside><main className="admin-main">
    {view === "intakes" && <><header className="admin-header"><div><h1 className="title-lg">오늘의 접수</h1><p className="muted body">새 접수가 들어오면 목록과 알림음으로 알려드려요.</p></div><div className={styles.toolbar}><button className="btn btn-secondary" onClick={() => setMuted((value) => !value)}>{muted ? <BellOff size={17}/> : <Bell size={17}/>} {muted ? "알림음 꺼짐" : "알림음 켜짐"}</button><button className="btn btn-secondary" onClick={() => load()}><RotateCcw size={17}/> 새로고침</button><button className={`btn btn-secondary ${styles.mobileLock}`} onClick={lock}><LogOut size={17}/> 화면 잠그기</button></div></header><div className="stat-grid"><div className="stat-card"><span className="caption tertiary">확인 대기</span><div className="stat-value">{count("pending_review")}</div></div><div className="stat-card"><span className="caption tertiary">촬영 대기</span><div className="stat-value">{count("waiting_shoot")}</div></div><div className="stat-card"><span className="caption tertiary">촬영 중</span><div className="stat-value">{count("shooting")}</div></div><div className="stat-card"><span className="caption tertiary">결제 대기</span><div className="stat-value">{count("payment_waiting")}</div></div></div><div className={styles.statusTabs}>{(["all","pending_review","waiting_shoot","shooting","payment_waiting","completed"] as const).map((status) => <button key={status} className={`${styles.statusTab} ${filter === status ? styles.statusTabActive : ""}`} onClick={() => setFilter(status)}>{status === "all" ? "전체" : statusLabels[status]}</button>)}</div><div className={styles.intakeList}>{visible.map((item) => <button className={`card card-select ${styles.intakeCard}`} key={item.id} onClick={() => setSelected(item)}><span className={styles.intakeNumber}>{item.intakeNumber}</span><span><span className={styles.customer}>{item.customer.name || "개인정보 삭제됨"}</span><span className={styles.phone}>{item.customer.phone ? `•••• ${item.customer.phone.slice(-4)}` : "7일 보관기간 만료"}</span></span><span className={styles.product}>{String(item.selectionSnapshot.productName ?? item.productId)}<br/><span className="caption tertiary">{formatWon(item.finalTotal ?? item.expectedTotal)}</span></span><span className={`badge ${badges[item.status]}`}>{statusLabels[item.status]}</span></button>)}{visible.length === 0 && <div className={`card ${styles.empty}`}>해당 상태의 접수가 없어요.</div>}</div></>}
    {view === "catalog" && canManageCatalog && <CatalogEditor />}
    {view === "settings" && <SettingsView muted={muted} setMuted={setMuted} />}
  </main><AnimatePresence>{selected && <motion.div className={styles.drawerBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}><motion.aside className={styles.drawer} initial={{ x: 40 }} animate={{ x: 0 }} exit={{ x: 40 }} transition={{ duration: .28 }} onClick={(e) => e.stopPropagation()}><div className={styles.drawerHead}><div><span className={`badge ${badges[selected.status]}`}>{statusLabels[selected.status]}</span><h2 className="title-lg" style={{ marginTop: 12 }}>{selected.intakeNumber} · {selected.customer.name}</h2></div><button className="btn btn-secondary" aria-label="닫기" onClick={() => setSelected(null)}><X size={18}/></button></div><div className={styles.detailGrid}><div className={styles.detailCell}><span>선택 상품</span><strong>{String(selected.selectionSnapshot.productName ?? selected.productId)}</strong></div>{selected.categoryId === "visa" && <div className={styles.detailCell}><span>비자 국가</span><strong>{String(selected.selectionSnapshot.visaCountryName ?? selected.visaCountryId ?? "미선택")}</strong></div>}<div className={styles.detailCell}><span>예상 금액</span><strong>{formatWon(selected.expectedTotal)}</strong></div><div className={styles.detailCell}><span>수령 희망</span><strong>{defaultCatalog.pickups.find((item) => item.id === selected.pickupId)?.name}</strong></div><div className={styles.detailCell}><span>할인 신청</span><strong>{selected.discountIds.length ? `${selected.discountIds.length}개 · 확인 필요` : "없음"}</strong></div><div className={styles.detailCell}><span>리뷰 참여</span><strong>{selected.reviewParticipation ? "참여 · 수정 파일 제공" : "참여 안 함"}</strong></div></div>{selected.customer.request && <div className={`card ${styles.detailCell}`}><span>고객 요청사항</span><p>{selected.customer.request}</p></div>}<IntakeEditor key={selected.id} item={selected} onSaved={(updated) => { setSelected(updated); setIntakes((rows) => rows.map((row) => row.id === updated.id ? updated : row)); }}/><div className={styles.statusActions}>{statusNext[selected.status] && <button className="btn btn-primary btn-block" onClick={() => changeStatus(selected, statusNext[selected.status]!)}>{statusLabels[statusNext[selected.status]!]}로 이동</button>}<button className="btn btn-secondary btn-block" onClick={() => changeStatus(selected, "cancelled")}>접수 취소</button></div></motion.aside></motion.div>}</AnimatePresence></div>;
}

function SettingsView({ muted, setMuted }: { muted: boolean; setMuted: (value: boolean) => void }) {
  return <><header className="admin-header"><div><h1 className="title-lg">키오스크 설정</h1><p className="muted body">매장 브랜드와 현장 동작을 관리해요.</p></div></header><div className="table-card" style={{ padding: 24, display: "grid", gap: 20 }}><label><span className="field-label">사진관 이름</span><input className="field" defaultValue={defaultCatalog.studio.name}/></label><label><span className="field-label">브랜드 색상</span><input className="field" type="color" defaultValue={defaultCatalog.studio.primaryColor}/></label><label><span className="field-label">하단 안내문구</span><input className="field" defaultValue={defaultCatalog.studio.supportCopy}/></label><label className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between" }}><span><strong>새 접수 알림음</strong><span className="caption tertiary" style={{ display: "block", marginTop: 4 }}>직원 화면에서 짧은 알림음을 재생해요.</span></span><input type="checkbox" checked={!muted} onChange={(e) => setMuted(!e.target.checked)}/></label><button className="btn btn-primary" style={{ justifySelf: "start" }}>설정 저장</button></div></>;
}







