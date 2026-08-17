"use client";

import { AnimatePresence, motion } from "motion/react";
import { Building2, MonitorSmartphone, Plus, Store, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./ops.module.css";

type Studio = { id: string; name: string; devices: number };
type Customer = { id: string; name: string; stores: Studio[] };
type RegisteredDevice = { id: string; organizationId: string; storeId: string; name: string; canManageCatalog: boolean; active: boolean; lastSeenAt: string | null; createdAt: string };
type PendingLicense = { id: string; organizationId: string; storeId: string; deviceName: string; canManageCatalog: boolean; createdAt: string };
type Tab = "customers" | "studios" | "devices";
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

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "접속 기록 없음";

export function OpsApp() {
  const [tab, setTab] = useState<Tab>("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [pendingLicenses, setPendingLicenses] = useState<PendingLicense[]>([]);
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
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const studios = useMemo(() => customers.flatMap((customer) => customer.stores.map((studio) => ({ ...studio, customer }))), [customers]);
  const customerNameById = (id: string) => customers.find((customer) => customer.id === id)?.name ?? "알 수 없는 고객";
  const studioNameById = (id: string) => studios.find((studio) => studio.id === id)?.name ?? "알 수 없는 사진관";

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

  const loadDevices = async () => {
    setDevicesLoading(true); setError("");
    const response = await fetch("/api/ops/devices", { cache: "no-store" });
    const body = await response.json().catch(() => null); setDevicesLoading(false);
    if (!response.ok) { setError(body?.error ?? "기기 목록을 불러오지 못했어요."); return; }
    setDevices(Array.isArray(body?.devices) ? body.devices : []);
    setPendingLicenses(Array.isArray(body?.pendingLicenses) ? body.pendingLicenses : []);
  };

  const changeTab = (nextTab: Tab) => {
    setTab(nextTab); setError("");
    if (nextTab === "devices") void loadDevices();
  };
  const closeModal = () => { setModal(null); setError(""); setLicenseKey(null); setSaving(false); };
  const openCustomerModal = () => { setCustomerName(""); setError(""); setModal("customer"); };
  const openStudioModal = (customer?: Customer) => {
    const target = customer ?? customers[0] ?? null;
    setSelectedCustomer(target); setSelectedStudio(null); setStudioName(""); setPin(""); setError(""); setModal("studio");
  };
  const openDeviceModal = (customer?: Customer, studio?: Studio) => {
    const targetCustomer = customer ?? customers[0] ?? null;
    const targetStudio = studio ?? targetCustomer?.stores[0] ?? null;
    setSelectedCustomer(targetCustomer); setSelectedStudio(targetStudio); setDeviceName(""); setCanManageCatalog(false); setLicenseKey(null); setError(""); setModal("device");
  };
  const selectCustomer = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId) ?? null;
    setSelectedCustomer(customer); setSelectedStudio(customer?.stores[0] ?? null);
  };

  const createCustomer = async () => {
    setSaving(true); setError("");
    const response = await fetch("/api/ops/organizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: customerName }) });
    const body = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setError(body?.error ?? "고객을 추가하지 못했어요."); return; }
    setCustomers((items) => [...items, ...normalizeCustomers([body])]); setCustomerName(""); closeModal();
  };

  const createStudio = async () => {
    if (!selectedCustomer) return;
    setSaving(true); setError("");
    const response = await fetch("/api/ops/stores", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: selectedCustomer.id, name: studioName, pin }) });
    const body = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setError(body?.error ?? "사진관을 추가하지 못했어요."); return; }
    setCustomers((items) => items.map((customer) => customer.id === selectedCustomer.id ? { ...customer, stores: [...customer.stores, { id: body.id, name: body.name, devices: 0 }] } : customer));
    setStudioName(""); setPin(""); closeModal();
  };

  const issueLicense = async () => {
    if (!selectedCustomer || !selectedStudio) return;
    setSaving(true); setError("");
    const response = await fetch("/api/ops/device-licenses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: selectedCustomer.id, storeId: selectedStudio.id, deviceName, canManageCatalog }) });
    const body = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setError(body?.error ?? "기기 등록 코드를 발급하지 못했어요."); return; }
    setLicenseKey(body.licenseKey);
    setPendingLicenses((items) => [{ id: body.id, organizationId: selectedCustomer.id, storeId: selectedStudio.id, deviceName, canManageCatalog, createdAt: new Date().toISOString() }, ...items]);
  };

  const updateDeviceState = async (kind: "device" | "license", id: string) => {
    const prompt = kind === "device" ? "이 기기의 접근을 비활성화할까요?" : "이 등록 코드를 폐기할까요?";
    if (!window.confirm(prompt)) return;
    setError("");
    const response = await fetch("/api/ops/devices", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id, action: kind === "device" ? "deactivate" : "revoke" }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) { setError(body?.error ?? "기기 상태를 변경하지 못했어요."); return; }
    if (kind === "device") setDevices((items) => items.map((device) => device.id === id ? { ...device, active: false } : device));
    else setPendingLicenses((items) => items.filter((license) => license.id !== id));
  };

  const title = tab === "customers" ? "고객 관리" : tab === "studios" ? "사진관 관리" : "기기 관리";
  const description = tab === "customers" ? "고객별 사진관과 기기 현황을 관리해요." : tab === "studios" ? "모든 고객의 사진관을 한곳에서 관리해요." : "활성 기기와 등록 대기 코드를 구분해 관리해요.";
  const primaryAction = tab === "customers" ? openCustomerModal : tab === "studios" ? () => openStudioModal() : () => openDeviceModal();
  const primaryLabel = tab === "customers" ? "고객 추가" : tab === "studios" ? "사진관 추가" : "기기 추가";
  const modalTitle = modal === "customer" ? "고객 추가" : modal === "studio" ? "사진관 추가" : "기기 등록 코드 발급";

  return <div className="admin-shell">
    <aside className="sidebar">
      <div className="brand">스튜디오 키오스크</div><div className="caption tertiary" style={{ marginTop: 5 }}>공급자 운영</div>
      <nav className="sidebar-nav">
        <button className={`sidebar-link ${tab === "customers" ? "active" : ""}`} onClick={() => changeTab("customers")}><Building2 size={18}/>고객 관리</button>
        <button className={`sidebar-link ${tab === "studios" ? "active" : ""}`} onClick={() => changeTab("studios")}><Store size={18}/>사진관 관리</button>
        <button className={`sidebar-link ${tab === "devices" ? "active" : ""}`} onClick={() => changeTab("devices")}><MonitorSmartphone size={18}/>기기 관리</button>
      </nav>
    </aside>
    <main className="admin-main">
      <header className="admin-header"><div><h1 className="title-lg">{title}</h1><p className="body muted">{description}</p></div><button className="btn btn-primary" disabled={tab !== "customers" && customers.length === 0} onClick={primaryAction}><Plus size={18}/> {primaryLabel}</button></header>
      {error && !modal && <div className="card error-copy" style={{ padding: 16, marginBottom: 18 }}>{error}</div>}

      {tab === "customers" && <div className={styles.customerList}>
        {loading && <div className="card" style={{ padding: 24 }}>고객을 불러오고 있어요.</div>}
        {customers.map((customer) => <section className={`card ${styles.customerCard}`} key={customer.id}>
          <header className={styles.customerHeader}><div><div className={styles.customerTitle}><Building2 size={20}/><h2>{customer.name}</h2></div><p className="caption tertiary">사진관 {customer.stores.length}개 · 등록 기기 {customer.stores.reduce((sum, studio) => sum + studio.devices, 0)}대</p></div><button className="btn btn-secondary" onClick={() => openStudioModal(customer)}><Plus size={17}/> 사진관 추가</button></header>
          <div className={styles.studioGrid}>{customer.stores.map((studio) => <article className={styles.studioCard} key={studio.id}><div className={styles.studioIcon}><Store size={20}/></div><div><strong>{studio.name}</strong><p className="caption tertiary">등록 기기 {studio.devices}대</p></div><button className="btn btn-secondary" onClick={() => openDeviceModal(customer, studio)}><Plus size={16}/> 기기 추가</button></article>)}{customer.stores.length === 0 && <button className={styles.emptyStudio} onClick={() => openStudioModal(customer)}><Plus size={18}/> 첫 사진관을 추가해 주세요</button>}</div>
        </section>)}
        {!loading && customers.length === 0 && <div className="card" style={{ padding: 24 }}>등록된 고객이 없어요.</div>}
      </div>}

      {tab === "studios" && <div className={styles.studioList}>
        {studios.map((studio) => <article className={`card ${styles.flatStudioCard}`} key={studio.id}><div className={styles.studioIcon}><Store size={22}/></div><div><strong>{studio.name}</strong><p className="caption tertiary">{studio.customer.name}</p></div><span className={styles.countBadge}>등록 기기 {studio.devices}대</span><button className="btn btn-secondary" onClick={() => openDeviceModal(studio.customer, studio)}><Plus size={16}/> 기기 추가</button></article>)}
        {!loading && studios.length === 0 && <div className="card" style={{ padding: 24 }}>등록된 사진관이 없어요.</div>}
      </div>}

      {tab === "devices" && <div className={styles.deviceSections}>
        <section><div className={styles.sectionTitle}><div><h2>활성 및 비활성 기기</h2><p className="caption tertiary">실제로 등록을 완료한 기기예요.</p></div><span className={styles.countBadge}>{devices.filter((device) => device.active).length}대 활성</span></div>
          <div className={styles.tableCard}>{devicesLoading ? <p>기기를 불러오고 있어요.</p> : devices.length === 0 ? <p>등록을 완료한 기기가 없어요.</p> : devices.map((device) => <div className={styles.deviceRow} key={device.id}><div><strong>{device.name}</strong><p className="caption tertiary">{customerNameById(device.organizationId)} · {studioNameById(device.storeId)}</p></div><span className={`${styles.statusBadge} ${device.active ? styles.statusActive : styles.statusOff}`}>{device.active ? "활성" : "비활성"}</span><div className={styles.deviceMeta}><span>{device.canManageCatalog ? "상품 관리 허용" : "접수 전용"}</span><span>{formatDate(device.lastSeenAt)}</span></div>{device.active && <button className="btn btn-secondary" onClick={() => void updateDeviceState("device", device.id)}>비활성화</button>}</div>)}</div>
        </section>
        <section><div className={styles.sectionTitle}><div><h2>등록 대기</h2><p className="caption tertiary">코드는 발급됐지만 아직 기기에서 사용되지 않았어요.</p></div><span className={styles.countBadge}>{pendingLicenses.length}건</span></div>
          <div className={styles.tableCard}>{devicesLoading ? <p>등록 코드를 불러오고 있어요.</p> : pendingLicenses.length === 0 ? <p>등록 대기 중인 기기가 없어요.</p> : pendingLicenses.map((license) => <div className={styles.deviceRow} key={license.id}><div><strong>{license.deviceName}</strong><p className="caption tertiary">{customerNameById(license.organizationId)} · {studioNameById(license.storeId)}</p></div><span className={`${styles.statusBadge} ${styles.statusPending}`}>등록 대기</span><div className={styles.deviceMeta}><span>{license.canManageCatalog ? "상품 관리 허용" : "접수 전용"}</span><span>{formatDate(license.createdAt)}</span></div><button className="btn btn-secondary" onClick={() => void updateDeviceState("license", license.id)}>코드 폐기</button></div>)}</div>
        </section>
      </div>}
    </main>

    <AnimatePresence>{modal && <motion.div className={styles.modalBackdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal}><motion.div className={styles.modal} initial={{ scale: .98, y: 10 }} animate={{ scale: 1, y: 0 }} transition={{ duration: .28 }} onClick={(event) => event.stopPropagation()}>
      <div className="admin-header" style={{ marginBottom: 0 }}><div><h2 className="title-lg">{modalTitle}</h2>{modal === "device" && selectedStudio && <p className="caption tertiary">{selectedCustomer?.name} · {selectedStudio.name}</p>}</div><button className="btn btn-secondary" aria-label="닫기" onClick={closeModal}><X size={18}/></button></div>
      {modal === "customer" && <div className={styles.formGrid}><label><span className="field-label">고객 이름</span><input className="field" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="예: 나다움 스튜디오"/></label>{error && <p className="error-copy">{error}</p>}<button className="btn btn-primary" disabled={saving || customerName.trim().length < 2} onClick={createCustomer}>{saving ? "추가 중..." : "고객 추가"}</button></div>}
      {modal === "studio" && <div className={styles.formGrid}><label><span className="field-label">고객</span><select className="field" value={selectedCustomer?.id ?? ""} onChange={(event) => selectCustomer(event.target.value)}>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label><label><span className="field-label">사진관 이름</span><input className="field" value={studioName} onChange={(event) => setStudioName(event.target.value)} placeholder="예: 순천 본점"/></label><label><span className="field-label">직원 공용 PIN</span><input className="field" type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="4~8자리 숫자"/></label>{error && <p className="error-copy">{error}</p>}<button className="btn btn-primary" disabled={saving || !selectedCustomer || !studioName.trim() || pin.length < 4} onClick={createStudio}>{saving ? "추가 중..." : "사진관 추가"}</button></div>}
      {modal === "device" && <div className={styles.formGrid}>{licenseKey ? <><div className={styles.licenseBox}><span className="caption tertiary">기기에서 한 번만 사용할 수 있는 등록 코드예요.</span><div>{licenseKey}</div></div><button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(licenseKey)}>등록 코드 복사</button></> : <><label><span className="field-label">고객</span><select className="field" value={selectedCustomer?.id ?? ""} onChange={(event) => selectCustomer(event.target.value)}>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label><label><span className="field-label">사진관</span><select className="field" value={selectedStudio?.id ?? ""} onChange={(event) => setSelectedStudio(selectedCustomer?.stores.find((studio) => studio.id === event.target.value) ?? null)}><option value="" disabled>사진관을 선택해 주세요</option>{selectedCustomer?.stores.map((studio) => <option value={studio.id} key={studio.id}>{studio.name}</option>)}</select></label><label><span className="field-label">기기 이름</span><input className="field" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="예: 입구 키오스크"/></label><label className="caption"><input type="checkbox" checked={canManageCatalog} onChange={(event) => setCanManageCatalog(event.target.checked)}/> 이 기기에서 상품 관리 허용</label>{error && <p className="error-copy">{error}</p>}<button className="btn btn-primary" disabled={saving || !selectedStudio || deviceName.trim().length < 2} onClick={issueLicense}>{saving ? "발급 중..." : "기기 등록 코드 발급"}</button></>}</div>}
    </motion.div></motion.div>}</AnimatePresence>
  </div>;
}
