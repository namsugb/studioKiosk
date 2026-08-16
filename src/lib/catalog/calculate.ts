import type { Catalog, Product } from "./schema";

export type PriceSelection = { addonIds: string[]; discountIds: string[]; pickupId?: string | null };

export function normalizeAddonSelection(catalog: Catalog, current: string[], toggledId: string) {
  if (current.includes(toggledId)) return current.filter((id) => id !== toggledId);
  const toggled = catalog.addons.find((item) => item.id === toggledId);
  if (!toggled) return current;
  const excluded = new Set(toggled.excludes);
  return [...current.filter((id) => !excluded.has(id) && !catalog.addons.find((item) => item.id === id)?.excludes.includes(toggledId)), toggledId];
}

export function normalizeDiscountSelection(catalog: Catalog, current: string[], toggledId: string) {
  if (current.includes(toggledId)) return current.filter((id) => id !== toggledId);
  return catalog.discountPolicy === "single" ? [toggledId] : [...current, toggledId];
}

export function getAddonPrice(catalog: Catalog, product: Product, addonId: string) {
  return product.addonPriceOverrides?.[addonId] ?? catalog.addons.find((item) => item.id === addonId)?.price ?? 0;
}

export function calculatePrice(catalog: Catalog, product: Product, selection: PriceSelection) {
  const addonTotal = selection.addonIds.reduce((sum, id) => sum + getAddonPrice(catalog, product, id), 0);
  const discountTotal = selection.discountIds.reduce((sum, id) => sum + (catalog.discounts.find((item) => item.id === id)?.amount ?? 0), 0);
  const pickupSurcharge = catalog.pickups.find((item) => item.id === selection.pickupId)?.surcharge ?? 0;
  return { base: product.price.amount, addonTotal, discountTotal, pickupSurcharge, total: product.price.amount === null ? null : Math.max(0, product.price.amount + addonTotal + pickupSurcharge - discountTotal) };
}

export function formatWon(amount: number | null, fallback = "가격 상담") {
  return amount === null ? fallback : `${amount.toLocaleString("ko-KR")}원`;
}

