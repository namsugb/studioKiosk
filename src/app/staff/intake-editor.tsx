"use client";

import { useMemo, useState } from "react";
import { defaultCatalog } from "@/lib/catalog/defaults";
import { formatWon } from "@/lib/catalog/calculate";
import type { IntakeRecord } from "@/lib/intakes/types";
import styles from "./intake-editor.module.css";

type Props = { item: IntakeRecord; onSaved: (item: IntakeRecord) => void };

export function IntakeEditor({ item, onSaved }: Props) {
  const [approvedIds, setApprovedIds] = useState(item.discountApprovedIds ?? []);
  const [pickupId, setPickupId] = useState(item.pickupId);
  const [finalTotal, setFinalTotal] = useState(item.finalTotal === null ? String(item.expectedTotal ?? "") : String(item.finalTotal));
  const [internalNote, setInternalNote] = useState(item.internalNote ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const product = useMemo(() => defaultCatalog.products.find((candidate) => candidate.id === item.productId), [item.productId]);
  const pickupOptions = defaultCatalog.pickups.filter((pickup) => !product || product.allowedPickupIds.includes(pickup.id));


  const toggleDiscount = (discountId: string) => {
    const next = approvedIds.includes(discountId) ? approvedIds.filter((id) => id !== discountId) : [...approvedIds, discountId];
    setApprovedIds(next);
    if (item.expectedTotal !== null) {
      const rejectedAmount = item.discountIds.filter((id) => !next.includes(id)).reduce((sum, id) => sum + (defaultCatalog.discounts.find((discount) => discount.id === id)?.amount ?? 0), 0);
      setFinalTotal(String(item.expectedTotal + rejectedAmount));
    }
  };

  const save = async () => {
    setSaving(true); setMessage("");
    const response = await fetch(`/api/staff/intakes/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ discountApprovedIds: approvedIds, pickupId, finalTotal: finalTotal === "" ? null : Number(finalTotal), internalNote }) });
    const body = await response.json().catch(() => null); setSaving(false);
    if (!response.ok) { setMessage(body?.error ?? "수정 내용을 저장하지 못했어요."); return; }
    onSaved(body); setMessage("수정 내용을 저장했어요.");
  };

  return <section className={styles.editPanel}><h3>직원 확인</h3>{item.discountIds.length > 0 && <fieldset><legend className="field-label">할인 승인</legend>{item.discountIds.map((id) => { const discount = defaultCatalog.discounts.find((candidate) => candidate.id === id); return <label className={styles.checkRow} key={id}><input type="checkbox" checked={approvedIds.includes(id)} onChange={() => toggleDiscount(id)}/><span>{discount?.name ?? id}<small>{discount ? `-${formatWon(discount.amount)}` : "신청 할인"}</small></span></label>; })}</fieldset>}<label><span className="field-label">출력물 수령시간</span><select className="field" value={pickupId} onChange={(event) => setPickupId(event.target.value)}>{pickupOptions.map((pickup) => <option key={pickup.id} value={pickup.id}>{pickup.name}</option>)}</select></label><label><span className="field-label">최종 결제 금액</span><input className="field" inputMode="numeric" value={finalTotal} onChange={(event) => setFinalTotal(event.target.value.replace(/\D/g, ""))} placeholder="가격 상담"/></label><label><span className="field-label">내부 메모</span><textarea className="field" rows={3} maxLength={500} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="고객에게 보이지 않아요."/></label>{message && <p className={message.includes("못") ? "error-copy" : "caption"}>{message}</p>}<button className="btn btn-secondary btn-block" disabled={saving} onClick={save}>{saving ? "저장 중..." : "수정 내용 저장"}</button></section>;
}
