"use client";

import { AnimatePresence, motion } from "motion/react";
import { Building2, KeyRound, MonitorSmartphone, Plus, Store, X } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./ops.module.css";

type Studio = { id: string; name: string; devices: number };
type Customer = { id: string; name: string; stores: Studio[] };
type Modal = "customer" | "studio" | "device" | null;

const normalizeCustomers = (value: unknown): Customer[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((customer): Customer[] => {
    if (!customer || typeof customer !== "object") return [];
    const row = customer as { id?: unknown; name?: unknown; stores?: unknown };
    if (typeof row.id !== "string" || typeof row.name !== "string") return [];
    const stores = Array.isArray(row.stores) ? row.stores.flatMap((studio): Studio[] => {
      if (!studio || typeof studio !== "object") return [];
      const item = studio as { id?: unknown; name?: unknown; devices?: unknown };
      if (typeof item.id !== "string" || typeof item.name !== "string") return [];
      return [{ id: item.id, name: item.name, devices: typeof item.devices === "number" ? item.devices : 0 }];
    }) : [];
    return [{ id: row.id, name: row.name, stores }];
  });
};

export function OpsApp() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedStudio, setSelectedStudio] = useState<Studio | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [studioName, setStudioName] = useState("");
  const [pin, setPin] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [canManageCatalog, setCanManageCatalog] = useState(false);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/ops/organizations", { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!active) return;
      setLoading(false);
      if (!response.ok) { setError(body?.error ?? "고객 목록을 불러오지 못했어요."); return; }
      setCustomers(normalizeCustomers(body));
    }).catch(() => { if (active) { setLoading(false); setError("고객 목록을 불러오지 못했어요."); } });
    return () => { active = false; };
  }, []);

  const closeModal = () => { setModal(null); setError(""); setLicenseKey(null); setSaving(false); };
  const openStudioModal = (customer: Customer) => {
    setSelectedCustomer(customer); setStudioName(""); setPin(""); setError(""); setModal("studio");
  };
  const openDeviceModal = (customer: Customer, studio: Studio) => {
    setSelectedCustomer(customer); setSelectedStudio(studio); setDeviceName(""); setCanManageCatalog(false); setLicenseKey(null); setError(""); setModal("device");
  };

  const createCustomer = async () => {
    setSaving(true); setError("");
    const response = await fetch("/api/ops/organizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: customerName }) });
    const body = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setError(body?.error ?? "고객을 추가하지 못했어요."); return; }
    setCustomers((items) => [...items, body]); setCustomerName(""); closeModal();
  };

  const createStudio = async () => {
    if (!selectedCustomer) return;
    setSaving(true); setError("");
    const response = await fetch("/api/ops/stores", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: selectedCustomer.id, name: studioName, pin }) });
    const body = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setError(body?.error ?? "사진관을 추가하지 못했어요."); return; }
    setCustomers((items) => items.map((customer) => customer.id === selectedCustomer.id ? { ...customer, stores: [...customer.stores, body] } : customer));
    setStudioName(""); setPin(""); closeModal();
  };

  const issueLicense = async () => {
    if (!selectedCustomer || !selectedStudio) return;
    setSaving(true); setError("");
    const response = await fetch("/api/ops/device-licenses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: selectedCustomer.id, storeId: selectedStudio.id, deviceName, canManageCatalog }) });
    const body = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setError(body?.error ?? "기기 라이선스를 발급하지 못했어요."); return; }
    setLicenseKey(body.licenseKey);
    setCustomers((items) => items.map((customer) => customer.id === selectedCustomer.id ? { ...customer, stores: customer.stores.map((studio) => studio.id === selectedStudio.id ? { ...studio, devices: studio.devices + 1 } : studio) } : customer));
  };

  const modalTitle = modal === "customer" ? "고객 추가" : modal === "studio" ? "사진관 추가" : "기기 추가";

  return <div className="admin-shell">
    <aside className="sidebar">
      <div className="brand">스튜디오 키오스크</div><div className="caption tertiary" style={{ marginTop: 5 }}>공급자 운영</div>
      <nav className="sidebar-nav"><button className="sidebar-link active"><Building2 size={18}/>고객 관리</button><button className="sidebar-link"><Store size={18}/>사진관 관리</button><button className="sidebar-link"><MonitorSmartphone size={18}/>기기 관리</button><button className="sidebar-link"><KeyRound size={18}/>기기 라이선스</button></nav>
    </aside>
    <main className="admin-main">
      <header className="admin-header"><div><h1 className="title-lg">고객 관리</h1><p className="body muted">고객 아래 사진관을 만들고, 사진관별로 기기를 연결해요.</p></div><button className="btn btn-primary" onClick={() => { setCustomerName(""); setError(""); setModal("customer"); }}><Plus size={18}/> 고객 추가</button></header>
      {error && !modal && <div className="card error-copy" style={{ padding: 16, marginBottom: 18 }}>{error}</div>}
      <div className={styles.customerList}>
        {loading && <div className="card" style={{ padding: 24 }}>고객을 불러오고 있어요.</div>}
        {customers.map((customer) => <section className={`card ${styles.customerCard}`} key={customer.id}>
          <header className={styles.customerHeader}><div><div className={styles.customerTitle}><Building2 size={20}/><h2>{customer.name}</h2></div><p className="caption tertiary">사진관 {customer.stores.length}개 · 기기 {customer.stores.reduce((sum, studio) => sum + studio.devices, 0)}대</p></div><button className="btn btn-secondary" onClick={() => openStudioModal(customer)}><Plus size={17}/> 사진관 추가</button></header>
          <div className={styles.studioGrid}>
            {customer.stores.map((studio) => <article className={styles.studioCard} key={studio.id}><div className={styles.studioIcon}><Store size={20}/></div><div><strong>{studio.name}</strong><p className="caption tertiary">연결 기기 {studio.devices}대</p></div><button className="btn btn-secondary" onClick={() => openDeviceModal(customer, studio)}><Plus size={16}/> 기기 추가</button></article>)}
            {customer.stores.length === 0 && <button className={styles.emptyStudio} onClick={() => openStudioModal(customer)}><Plus size={18}/> 첫 사진관을 추가해 주세요</button>}
          </div>
        </section>)}
        {!loading && customers.length === 0 && <div className="card" style={{ padding: 24 }}>등록된 고객이 없어요.</div>}
      </div>
    </main>
    <AnimatePresence>{modal && <motion.div className={styles.modalBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal}><motion.div className={styles.modal} initial={{ scale: .98, y: 10 }} animate={{ scale: 1, y: 0 }} transition={{ duration: .28 }} onClick={(event) => event.stopPropagation()}>
      <div className="admin-header" style={{ marginBottom: 0 }}><div><h2 className="title-lg">{modalTitle}</h2>{modal !== "customer" && <p className="caption tertiary">{selectedCustomer?.name}{selectedStudio ? ` · ${selectedStudio.name}` : ""}</p>}</div><button className="btn btn-secondary" aria-label="닫기" onClick={closeModal}><X size={18}/></button></div>
      {modal === "customer" && <div className={styles.formGrid}><label><span className="field-label">고객 이름</span><input className="field" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="예: 나다움 스튜디오"/></label>{error && <p className="error-copy">{error}</p>}<button className="btn btn-primary" disabled={saving || customerName.trim().length < 2} onClick={createCustomer}>{saving ? "추가 중..." : "고객 추가"}</button></div>}
      {modal === "studio" && <div className={styles.formGrid}><label><span className="field-label">사진관 이름</span><input className="field" value={studioName} onChange={(event) => setStudioName(event.target.value)} placeholder="예: 순천 본점"/></label><label><span className="field-label">직원 공용 PIN</span><input className="field" type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="4~8자리 숫자"/></label>{error && <p className="error-copy">{error}</p>}<button className="btn btn-primary" disabled={saving || !studioName.trim() || pin.length < 4} onClick={createStudio}>{saving ? "추가 중..." : "사진관 추가"}</button></div>}
      {modal === "device" && <div className={styles.formGrid}>{licenseKey ? <><div className={styles.licenseBox}><span className="caption tertiary">이 기기에서 한 번만 사용할 수 있어요.</span><div>{licenseKey}</div></div><button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(licenseKey)}>라이선스 복사</button></> : <><label><span className="field-label">기기 이름</span><input className="field" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="예: 입구 키오스크"/></label><label className="caption"><input type="checkbox" checked={canManageCatalog} onChange={(event) => setCanManageCatalog(event.target.checked)}/> 이 기기에서 상품 관리 허용</label>{error && <p className="error-copy">{error}</p>}<button className="btn btn-primary" disabled={saving || deviceName.trim().length < 2} onClick={issueLicense}>{saving ? "발급 중..." : "기기 라이선스 발급"}</button></>}</div>}
    </motion.div></motion.div>}</AnimatePresence>
  </div>;
}
