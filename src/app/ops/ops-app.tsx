"use client";

import { AnimatePresence, motion } from "motion/react";
import { Building2, KeyRound, MonitorSmartphone, Plus, Store, X } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./ops.module.css";

type Organization = { id: string; name: string; stores: number; devices: number; storeId: string | null };
type Modal = "org" | "device" | null;

export function OpsApp() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("본점");
  const [pin, setPin] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState<"kiosk" | "staff_terminal">("kiosk");
  const [canManageCatalog, setCanManageCatalog] = useState(false);
  const [activation, setActivation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/ops/organizations", { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!active) return;
      setLoading(false);
      if (!response.ok) { setError(body?.error ?? "사진관 목록을 불러오지 못했어요."); return; }
      setOrganizations(body);
    }).catch(() => { if (active) { setLoading(false); setError("사진관 목록을 불러오지 못했어요."); } });
    return () => { active = false; };
  }, []);

  const closeModal = () => { setModal(null); setError(""); setActivation(null); };
  const createOrganization = async () => {
    setSaving(true); setError("");
    const response = await fetch("/api/ops/organizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, storeName, pin }) });
    const body = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setError(body?.error ?? "사진관을 만들지 못했어요."); return; }
    setOrganizations((items) => [...items, body]); setName(""); setStoreName("본점"); setPin(""); closeModal();
  };
  const openDeviceModal = (organization: Organization) => {
    setSelectedOrganization(organization); setActivation(null); setDeviceName(""); setDeviceType("kiosk"); setCanManageCatalog(false); setError(""); setModal("device");
  };
  const issueCode = async () => {
    if (!selectedOrganization?.storeId) { setError("기기를 연결할 지점이 없어요."); return; }
    setSaving(true); setError("");
    const response = await fetch("/api/ops/device-activations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: selectedOrganization.id, storeId: selectedOrganization.storeId, deviceType, deviceName, canManageCatalog }) });
    const body = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setError(body?.error ?? "활성화 코드를 만들지 못했어요."); return; }
    setActivation(body.code);
  };

  return <div className="admin-shell"><aside className="sidebar"><div className="brand">스튜디오 키오스크</div><div className="caption tertiary" style={{ marginTop: 5 }}>공급자 운영</div><nav className="sidebar-nav"><button className="sidebar-link active"><Building2 size={18}/>사진관 관리</button><button className="sidebar-link"><MonitorSmartphone size={18}/>기기 관리</button><button className="sidebar-link"><KeyRound size={18}/>활성화 코드</button></nav></aside><main className="admin-main"><header className="admin-header"><div><h1 className="title-lg">사진관 관리</h1><p className="body muted">사진관을 만들고 기본 상품 템플릿과 기기를 연결해요.</p></div><button className="btn btn-primary" onClick={() => { setError(""); setModal("org"); }}><Plus size={18}/> 사진관 추가</button></header>{error && !modal && <div className="card error-copy" style={{ padding: 16, marginBottom: 18 }}>{error}</div>}<div className={styles.orgGrid}>{loading && <div className="card" style={{ padding: 24 }}>사진관을 불러오고 있어요.</div>}{organizations.map((org) => <article className={`card ${styles.orgCard}`} key={org.id}><div className={styles.orgIcon}><Store/></div><h2 style={{ margin: 0, fontSize: 19 }}>{org.name}</h2><p className="caption tertiary">기본 상품 템플릿 · 운영 중</p><div className={styles.orgMeta}><span>지점 {org.stores}</span><span>기기 {org.devices}</span></div><button className="btn btn-secondary btn-block" style={{ marginTop: 20 }} onClick={() => openDeviceModal(org)}>기기 등록</button></article>)}{!loading && organizations.length === 0 && <div className="card" style={{ padding: 24 }}>등록된 사진관이 없어요.</div>}</div><section className={styles.deviceTable}><header className="admin-header"><div><h2 style={{ margin: 0, fontSize: 20 }}>기기 연결 안내</h2><p className="caption tertiary">사진관 카드에서 일회용 코드를 만든 뒤 새 기기의 /activate 화면에 입력해 주세요.</p></div></header></section></main><AnimatePresence>{modal && <motion.div className={styles.modalBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal}><motion.div className={styles.modal} initial={{ scale: .98, y: 10 }} animate={{ scale: 1, y: 0 }} transition={{ duration: .28 }} onClick={(event) => event.stopPropagation()}><div className="admin-header" style={{ marginBottom: 0 }}><h2 className="title-lg">{modal === "org" ? "사진관 추가" : "기기 활성화 코드"}</h2><button className="btn btn-secondary" aria-label="닫기" onClick={closeModal}><X size={18}/></button></div>{modal === "org" ? <div className={styles.formGrid}><label><span className="field-label">사진관 이름</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="사진관 이름"/></label><label><span className="field-label">첫 지점 이름</span><input className="field" value={storeName} onChange={(event) => setStoreName(event.target.value)}/></label><label><span className="field-label">직원 공용 PIN</span><input className="field" type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="4~8자리 숫자"/></label>{error && <p className="error-copy">{error}</p>}<button className="btn btn-primary" disabled={saving || name.trim().length < 2 || !storeName.trim() || pin.length < 4} onClick={createOrganization}>{saving ? "만드는 중..." : "기본 템플릿으로 만들기"}</button></div> : <div className={styles.formGrid}>{activation ? <><div style={{ padding: 22, borderRadius: 16, background: "var(--surface)", textAlign: "center" }}><span className="caption tertiary">10분 동안 한 번만 사용할 수 있어요.</span><div style={{ marginTop: 10, fontSize: 30, fontWeight: 700, letterSpacing: ".12em" }}>{activation}</div></div><button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(activation)}>코드 복사</button></> : <><p className="caption tertiary" style={{ margin: 0 }}>{selectedOrganization?.name} · 첫 지점</p><label><span className="field-label">기기 용도</span><select className="field" value={deviceType} onChange={(event) => setDeviceType(event.target.value as "kiosk" | "staff_terminal")}><option value="kiosk">고객 키오스크</option><option value="staff_terminal">직원 화면</option></select></label><label><span className="field-label">기기 이름</span><input className="field" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="예: 입구 키오스크"/></label>{deviceType === "staff_terminal" && <label className="caption"><input type="checkbox" checked={canManageCatalog} onChange={(event) => setCanManageCatalog(event.target.checked)}/> 이 기기에서 상품 관리 허용</label>}{error && <p className="error-copy">{error}</p>}<button className="btn btn-primary" disabled={saving || deviceName.trim().length < 2} onClick={issueCode}>{saving ? "발급 중..." : "일회용 코드 발급"}</button></>}</div>}</motion.div></motion.div>}</AnimatePresence></div>;
}