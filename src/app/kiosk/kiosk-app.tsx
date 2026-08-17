"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, BriefcaseBusiness, Camera, Check, ChevronLeft, IdCard, Plane, ScanFace, UserRound, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Catalog } from "@/lib/catalog/schema";
import { calculatePrice, formatWon, getAddonPrice, normalizeAddonSelection, normalizeDiscountSelection } from "@/lib/catalog/calculate";
import type { IntakeSubmission } from "@/lib/intakes/types";
import { cacheCatalog, flushOutbox, getCachedCatalog, queueIntake } from "@/lib/offline/db";
import { visaCountries, type VisaCountryId } from "@/lib/catalog/visa-countries";
import { BeforeAfterPreview } from "./before-after-preview";
import { VisaCountryStep } from "./visa-country-step";
import styles from "./kiosk.module.css";

type Step = "idle" | "category" | "visa-country" | "tier" | "product" | "options" | "pickup" | "customer" | "consent" | "confirm" | "submitting" | "complete";
type Draft = { categoryId: string | null; tierId: string | null; productId: string | null; addonIds: string[]; discountIds: string[]; reviewParticipation: boolean; sampleConsent: boolean; visaCountryId: string | null; pickupId: string | null; name: string; phone: string; request: string; privacyConsent: boolean };
const emptyDraft: Draft = { categoryId: null, tierId: null, productId: null, addonIds: [], discountIds: [], reviewParticipation: false, sampleConsent: false, visaCountryId: null, pickupId: null, name: "", phone: "", request: "", privacyConsent: false };
const standardSteps: Step[] = ["category", "tier", "product", "options", "pickup", "customer", "consent", "confirm"];
const visaSteps: Step[] = ["category", "visa-country", "tier", "product", "options", "pickup", "customer", "consent", "confirm"];
const iconMap = { "id-card": IdCard, "scan-face": ScanFace, "briefcase-business": BriefcaseBusiness, plane: Plane, "user-round": UserRound };

export function KioskApp({ initialCatalog, accessToken, deviceId }: { initialCatalog: Catalog; accessToken: string | null; deviceId: string | null }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState(initialCatalog);
  const [step, setStep] = useState<Step>("idle");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [online, setOnline] = useState(true);
  const [receipt, setReceipt] = useState<{ intakeNumber: string; queued: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submittingRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const product = catalog.products.find((item) => item.id === draft.productId) ?? null;
  const category = catalog.categories.find((item) => item.id === draft.categoryId);
  const tier = catalog.tiers.find((item) => item.id === draft.tierId);
  const pickup = catalog.pickups.find((item) => item.id === draft.pickupId);
  const price = useMemo(() => product ? calculatePrice(catalog, product, draft) : null, [catalog, product, draft]);
  const selectedVisaCountry = visaCountries.find((item) => item.id === draft.visaCountryId);
  const activeSteps = draft.categoryId === "visa" ? visaSteps : standardSteps;

  useEffect(() => {
    document.documentElement.style.setProperty("--brand", catalog.studio.primaryColor);
    cacheCatalog(catalog).catch(() => undefined);
    getCachedCatalog().then((cached) => { if (!navigator.onLine && cached) setCatalog(cached); }).catch(() => undefined);
    const sync = () => { setOnline(true); flushOutbox(accessToken, deviceId).catch(() => undefined); };
    const offline = () => setOnline(false);
    window.addEventListener("online", sync); window.addEventListener("offline", offline); flushOutbox(accessToken, deviceId).catch(() => undefined);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", offline); };
  }, [accessToken, catalog, deviceId]);

  useEffect(() => {
    if (step !== "complete") return;
    const timer = window.setTimeout(() => { submittingRef.current = false; setStep("idle"); setDraft(emptyDraft); setReceipt(null); }, 20000);
    return () => window.clearTimeout(timer);
  }, [step]);

  const goBack = () => { const index = activeSteps.indexOf(step); if (index > 0) setStep(activeSteps[index - 1]); else setStep("idle"); };
  const goToCategory = () => { setDraft(emptyDraft); setErrors({}); setStep("category"); };
  const chooseCategory = (id: string) => { setDraft({ ...emptyDraft, categoryId: id }); window.setTimeout(() => setStep(id === "visa" ? "visa-country" : "tier"), reduceMotion ? 0 : 120); };
  const chooseVisaCountry = (id: VisaCountryId) => { setDraft((value) => ({ ...value, visaCountryId: id })); window.setTimeout(() => setStep("tier"), reduceMotion ? 0 : 120); };
  const chooseTier = (id: string) => { const selected = catalog.products.find((item) => item.categoryId === draft.categoryId && item.tierId === id && item.active); if (!selected) return; setDraft((value) => ({ ...value, tierId: id, productId: selected.id, addonIds: [], discountIds: [], reviewParticipation: false, sampleConsent: false, pickupId: null })); window.setTimeout(() => setStep("product"), reduceMotion ? 0 : 120); };
  const availableAddons = product ? catalog.addons.filter((item) => product.allowedAddonIds.includes(item.id) && item.active) : [];
  const availablePickups = product ? catalog.pickups.filter((item) => product.allowedPickupIds.includes(item.id) && item.active) : [];
  const monthlyEventEligible = draft.sampleConsent && draft.reviewParticipation;

  const validateCustomer = () => {
    const next: Record<string,string> = {};
    if (draft.name.trim().length < 2) next.name = "이름을 2자 이상 입력해 주세요.";
    if (!/^01[016789]\d{7,8}$/.test(draft.phone.replace(/\D/g, ""))) next.phone = "휴대전화 번호를 확인해 주세요.";
    setErrors(next); if (Object.keys(next).length === 0) setStep("consent");
  };

  const submit = useCallback(async () => {
    if (submittingRef.current || !product || !draft.categoryId || !draft.tierId || !draft.pickupId || !draft.privacyConsent) return;
    submittingRef.current = true;
    setStep("submitting");
    const submission: IntakeSubmission = {
      clientSubmissionId: crypto.randomUUID(), catalogReleaseId: catalog.releaseId, categoryId: draft.categoryId, tierId: draft.tierId, productId: product.id,
      addonIds: draft.addonIds, discountIds: draft.discountIds, reviewParticipation: draft.reviewParticipation, sampleConsent: draft.sampleConsent, visaCountryId: draft.visaCountryId, pickupId: draft.pickupId,
      customer: { name: draft.name.trim(), phone: draft.phone.replace(/\D/g, ""), request: draft.request.trim() }, privacyConsent: true, expectedTotal: price?.total ?? null,
      selectionSnapshot: { categoryName: category?.name, tierName: tier?.name, productName: product.name, productPrice: product.price, addonIds: draft.addonIds, discountIds: draft.discountIds, reviewParticipation: draft.reviewParticipation, sampleConsent: draft.sampleConsent, monthlyEventEligible, visaCountryId: draft.visaCountryId, visaCountryName: selectedVisaCountry?.name, pickupName: pickup?.name }
    };
    setErrors((current) => ({ ...current, submit: "" }));
    try {
      if (!navigator.onLine) throw new Error("offline");
      const response = await fetch("/api/intakes", { method: "POST", headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}), ...(deviceId ? { "x-device-id": deviceId } : {}) }, body: JSON.stringify(submission) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (response.status >= 500) throw new Error("server-unavailable");
        setErrors((current) => ({ ...current, submit: body?.error ?? "접수 내용을 다시 확인해 주세요." }));
        submittingRef.current = false;
        setStep("confirm");
        return;
      }
      const data = await response.json(); setReceipt({ intakeNumber: data.intakeNumber, queued: false });
    } catch {
      await queueIntake(submission); setReceipt({ intakeNumber: `OFF-${submission.clientSubmissionId.slice(0, 4).toUpperCase()}`, queued: true });
    }
    setStep("complete");
  }, [accessToken, catalog.releaseId, category?.name, deviceId, draft, monthlyEventEligible, pickup?.name, price?.total, product, selectedVisaCountry?.name, tier?.name]);

  const progress = Math.max(0, activeSteps.indexOf(step) + 1) / activeSteps.length * 100;
  const transition = reduceMotion ? { duration: 0.01 } : { duration: .2, ease: [0.22, 0.61, 0.36, 1] as const };

  if (step === "idle") return <main className={styles.idle} style={{ "--brand": catalog.studio.primaryColor } as CSSProperties}><button className="brand brand-button" onClick={() => router.push("/staff")}>{catalog.studio.name}</button><div className={styles.idleMain}><motion.div className={styles.idleVisual} initial={{ scale: .96 }} animate={{ scale: 1 }} transition={transition}><Camera /></motion.div><h1 className="title-xl">촬영 접수를 시작해 주세요</h1><p className={styles.lead}>{catalog.studio.tagline}</p><button className={`btn btn-primary ${styles.idleButton}`} onClick={() => setStep("category")}>촬영 접수하기</button></div><p className="support-copy">{catalog.studio.supportCopy}</p></main>;

  if (step === "complete") return <main className={styles.complete}><div><motion.div className={styles.completeIcon} initial={reduceMotion ? undefined : { scale: .86, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: .24 }}><Check /></motion.div><h1 className="title-xl">접수가 완료됐어요</h1><p className={styles.lead}>잠시 기다리시면 직원이 확인 후 안내해 드릴게요.</p>{receipt?.queued && <div className={styles.offline}><WifiOff size={18} /> 오프라인 접수예요. 이 화면을 직원에게 보여 주세요.</div>}<div className={styles.intakeNumber}>{receipt?.intakeNumber}</div><div className={styles.completeSummary}><div className={styles.summaryRow}><span>선택 상품</span><strong>{product?.name}</strong></div><div className={styles.summaryRow}><span>수령 희망</span><strong>{pickup?.name}</strong></div><div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>예상 금액</span><strong>{formatWon(price?.total ?? null)}</strong></div></div><p className="support-copy">{catalog.studio.supportCopy}</p><button className="btn btn-secondary" style={{ marginTop: 24 }} onClick={() => { submittingRef.current = false; setStep("idle"); setDraft(emptyDraft); setReceipt(null); }}>처음 화면으로</button></div></main>;

  return <main className="kiosk-wrap"><header className="topbar"><button className="btn btn-ghost" style={{ padding: 0 }} onClick={goBack}><ChevronLeft size={20} /> 이전</button><button className="brand brand-button" onClick={goToCategory}>{catalog.studio.name}</button></header><div className="progress-track"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>{!online && <div className={styles.offline} style={{ margin: "12px 24px 0" }}>인터넷 연결이 없어도 접수할 수 있어요.</div>}<div className={styles.content}><AnimatePresence mode="wait"><motion.section key={step} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -8 }} transition={transition}>
    {step === "category" && <><h1 className="title-lg">어디에 사용할 사진인가요?</h1><p className={styles.lead}>사진 종류를 선택하면 바로 다음 단계로 넘어가요.</p><div className={styles.categoryGrid}>{catalog.categories.filter((item) => item.active).sort((a,b) => a.order-b.order).map((item) => { const Icon = iconMap[item.icon as keyof typeof iconMap] ?? Camera; return <button key={item.id} className={`card card-select ${styles.categoryCard}`} onClick={() => chooseCategory(item.id)}><span className={styles.categoryIcon}><Icon /></span><span><span className={styles.categoryName}>{item.name}</span><span className={styles.categoryDescription}>{item.description}</span></span></button>; })}</div></>}
    {step === "visa-country" && <VisaCountryStep onSelect={chooseVisaCountry} />}
    {step === "tier" && <><h1 className="title-lg">어느 정도로 보정할까요?</h1><p className={styles.lead}>원하는 보정 범위를 선택해 주세요.</p><div className={styles.tierList}>{catalog.tiers.sort((a,b) => a.order-b.order).map((item) => { const itemProduct = catalog.products.find((p) => p.categoryId === draft.categoryId && p.tierId === item.id); if (!itemProduct) return null; return <button key={item.id} className={`card card-select ${styles.tierCard}`} onClick={() => chooseTier(item.id)}><span className={styles.tierName}>{item.name}</span><span className={`${styles.tierPrice} price`}>{formatWon(itemProduct.price.amount, itemProduct.price.label)}</span><span className={styles.tierSubtitle}>{itemProduct.tierSubtitle ?? item.subtitle}</span><span></span><span className={styles.tierDescription}>{itemProduct.tierDescription ?? item.description}</span><span className={styles.featureRow}>{(itemProduct.tierFeatures ?? item.features).map((feature) => <span className="chip" key={feature}>{feature}</span>)}</span></button>; })}</div></>}
    {step === "product" && product && <><h1 className="title-lg">선택한 촬영 상품이에요</h1><p className={styles.lead}>상품 구성과 예상 작업시간을 확인해 주세요.</p><article className={`card ${styles.productCard}`}><div className={styles.productHead}><div><span className="badge badge-blue">{tier?.subtitle}</span><h2 className={styles.productName}>{product.name}</h2><p className="muted">{product.tag}</p></div><strong className={`${styles.productPrice} price`}>{formatWon(product.price.amount, product.price.label)}</strong></div><ul className={styles.detailList}>{product.details.map((detail) => <li key={detail}><BadgeCheck />{detail}</li>)}<li><BadgeCheck />{product.durationLabel ? `예상 소요시간 ${product.durationLabel}` : product.durationMinutes ? `예상 소요시간 약 ${product.durationMinutes}분` : "예상 소요시간은 직원과 상담해요."}</li></ul></article><BeforeAfterPreview categoryName={category?.name ?? "촬영 상품"} /></>}
    {step === "options" && product && <><h1 className="title-lg">추가로 필요한 항목이 있나요?</h1><p className={styles.lead}>추가 옵션과 받을 수 있는 혜택을 선택해 주세요.</p><h2 className={styles.sectionTitle}>추가 옵션</h2>{availableAddons.map((item) => { const included = product.includedAddonIds.includes(item.id); return <label className={`${styles.optionRow} ${included ? styles.optionRowIncluded : ""}`} key={item.id}><input type="checkbox" checked={included || draft.addonIds.includes(item.id)} disabled={included} onChange={() => { if (!included) setDraft((value) => ({ ...value, addonIds: normalizeAddonSelection(catalog, value.addonIds, item.id) })); }} /><span><span className={styles.optionName}>{item.name}</span><span className={styles.optionDescription}>{item.description}</span>{included && <span className={styles.includedNote}>선택한 상품에 기본 포함되어 있어요.</span>}</span><span className={styles.optionPrice}>{included ? "기본 포함" : `+${formatWon(getAddonPrice(catalog, product, item.id))}`}</span></label>; })}<h2 className={styles.sectionTitle}>할인 신청</h2>{catalog.discounts.filter((item) => item.active).map((item) => <label className={styles.optionRow} key={item.id}><input type="checkbox" checked={draft.discountIds.includes(item.id)} onChange={() => setDraft((value) => ({ ...value, discountIds: normalizeDiscountSelection(catalog, value.discountIds, item.id) }))} /><span><span className={styles.optionName}>{item.name}</span><span className={styles.optionDescription}>{item.description}</span></span><span className={styles.optionPrice}>-{formatWon(item.amount)}</span></label>)}<h2 className={styles.sectionTitle}>리뷰 참여</h2><label className={`card ${styles.reviewCard}`}><input type="checkbox" checked={draft.reviewParticipation} onChange={(event) => setDraft((value) => ({ ...value, reviewParticipation: event.target.checked }))} /><span><span className={styles.optionName}>리뷰에 참여할게요</span><span className={styles.optionDescription}>촬영 후 리뷰에 참여하시면 수정 파일을 제공해 드려요.</span></span><span className={styles.reviewBenefit}>수정 파일 제공</span></label></>}
    {step === "options" && product && <><h2 className={styles.sectionTitle}>이달의 이벤트</h2><label className={`card ${styles.reviewCard}`}><input type="checkbox" checked={draft.sampleConsent} onChange={(event) => setDraft((value) => ({ ...value, sampleConsent: event.target.checked }))} /><span><span className={styles.optionName}>사진 샘플 활용에 동의할게요 <span className="tertiary">(선택)</span></span><span className={styles.optionDescription}>샘플 활용 동의와 리뷰 참여를 모두 선택하면 헤어·의상 교체를 제공해 드려요.</span></span><span className={styles.reviewBenefit}>{monthlyEventEligible ? "혜택 적용" : "헤어·의상 교체"}</span></label></>}
    {step === "pickup" && <><h1 className="title-lg">언제 받기를 원하시나요?</h1><p className={styles.lead}>현장 상황에 따라 직원이 최종 시간을 안내해 드려요.</p><div className={styles.pickupList}>{availablePickups.map((item) => <label className={`card ${styles.pickupCard}`} key={item.id}><input type="radio" name="pickup" checked={draft.pickupId === item.id} onChange={() => setDraft((value) => ({ ...value, pickupId: item.id }))} /><span><span className={styles.optionName}>{item.name}</span><span className={styles.optionDescription}>{item.description}</span></span>{item.surcharge > 0 && <strong>+{formatWon(item.surcharge)}</strong>}</label>)}</div></>}
    {step === "customer" && <><h1 className="title-lg">접수 정보를 입력해 주세요</h1><p className={styles.lead}>직원이 고객님을 확인하고 촬영을 안내할 때 사용해요.</p><div className={styles.formGrid}><label><span className="field-label">이름</span><input className={`field ${errors.name ? "field-error" : ""}`} value={draft.name} autoComplete="off" onChange={(e) => setDraft((value) => ({ ...value, name: e.target.value }))} placeholder="이름을 입력해 주세요" />{errors.name && <span className="error-copy">{errors.name}</span>}</label><label><span className="field-label">휴대전화 번호</span><input className={`field ${errors.phone ? "field-error" : ""}`} value={draft.phone} inputMode="numeric" autoComplete="off" onChange={(e) => setDraft((value) => ({ ...value, phone: e.target.value.replace(/\D/g, "").slice(0, 11) }))} placeholder="01012345678" />{errors.phone && <span className="error-copy">{errors.phone}</span>}</label><label><span className="field-label">요청사항 <span className="tertiary">(선택)</span></span><textarea className="field" rows={4} maxLength={300} value={draft.request} onChange={(e) => setDraft((value) => ({ ...value, request: e.target.value }))} placeholder="직원에게 전달할 내용을 입력해 주세요" /></label></div></>}
    {step === "consent" && <><h1 className="title-lg">개인정보 이용에 동의해 주세요</h1><p className={styles.lead}>현장 접수와 촬영 진행에 필요한 정보만 사용해요.</p><label className={`card ${styles.consentCard}`}><input type="checkbox" checked={draft.privacyConsent} onChange={(e) => setDraft((value) => ({ ...value, privacyConsent: e.target.checked }))} /><span><strong>개인정보 수집 및 이용에 동의해요. <span style={{ color: "var(--brand)" }}>필수</span></strong><ul className={styles.privacyList}><li>수집 항목: 이름, 휴대전화 번호, 요청사항</li><li>이용 목적: 현장 고객 확인과 촬영 진행</li><li>보유 기간: 접수일로부터 {catalog.studio.privacyRetentionDays}일</li></ul></span></label></>}
    {step === "confirm" && product && <><h1 className="title-lg">접수 내용을 확인해 주세요</h1><p className={styles.lead}>직원이 확인한 후 촬영을 안내해 드려요.</p><div className={styles.summary}><div className={styles.summaryRow}><span>고객</span><strong>{draft.name} · {draft.phone.slice(-4)}</strong></div><div className={styles.summaryRow}><span>촬영 상품</span><strong>{product.name}</strong></div>{selectedVisaCountry && <div className={styles.summaryRow}><span>비자 국가</span><strong>{selectedVisaCountry.name} · {selectedVisaCountry.size}</strong></div>}<div className={styles.summaryRow}><span>추가 옵션</span><strong>{draft.addonIds.length ? `${draft.addonIds.length}개` : "선택 안 함"}</strong></div><div className={styles.summaryRow}><span>할인 신청</span><strong>{draft.discountIds.length ? `${draft.discountIds.length}개` : "선택 안 함"}</strong></div><div className={styles.summaryRow}><span>리뷰 참여</span><strong>{draft.reviewParticipation ? "참여 · 수정 파일 제공" : "참여 안 함"}</strong></div><div className={styles.summaryRow}><span>수령 희망</span><strong>{pickup?.name}</strong></div><div className={styles.summaryRow}><span>결제</span><strong>촬영 후 현장 결제</strong></div><div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>예상 결제 금액</span><strong>{formatWon(price?.total ?? null)}</strong></div></div><p className="caption tertiary">할인은 직원 확인 후 최종 적용돼요.</p>{errors.submit && <p className="error-copy">{errors.submit}</p>}</>}
    {step === "submitting" && <><h1 className="title-lg">접수하고 있어요</h1><p className={styles.lead}>잠시만 기다려 주세요.</p></>}
  </motion.section></AnimatePresence></div>
  {!["category", "visa-country", "tier", "submitting"].includes(step) && <div className="bottom-cta"><div className="bottom-cta-row"><button className="btn btn-secondary" onClick={goBack}>이전</button>{step === "product" && <button className="btn btn-primary" onClick={() => setStep("options")}>이 상품 선택</button>}{step === "options" && <button className="btn btn-primary" onClick={() => setStep("pickup")}>{formatWon(price?.total ?? null)} · 수령 시간 선택</button>}{step === "pickup" && <button className="btn btn-primary" disabled={!draft.pickupId} onClick={() => setStep("customer")}>접수 정보 입력</button>}{step === "customer" && <button className="btn btn-primary" onClick={validateCustomer}>개인정보 확인</button>}{step === "consent" && <button className="btn btn-primary" disabled={!draft.privacyConsent} onClick={() => setStep("confirm")}>접수 내용 확인</button>}{step === "confirm" && <button className="btn btn-primary" onClick={submit}>접수 완료하기</button>}</div><p className="support-copy">{catalog.studio.supportCopy}</p></div>}
  </main>;
}












