import type { IntakeSubmission } from "@/lib/intakes/types";
import { calculatePrice, getAddonPrice } from "./calculate";
import type { Catalog } from "./schema";
import { visaCountries } from "./visa-countries";

type ValidationResult = { success: true; submission: IntakeSubmission } | { success: false; error: string };

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length;
}

export function validateSubmissionAgainstCatalog(catalog: Catalog, input: IntakeSubmission): ValidationResult {
  const category = catalog.categories.find((item) => item.id === input.categoryId && item.active);
  const tier = catalog.tiers.find((item) => item.id === input.tierId);
  const product = catalog.products.find((item) => item.id === input.productId && item.active);
  if (!category || !tier || !product || product.categoryId !== category.id || product.tierId !== tier.id) {
    return { success: false, error: "선택한 상품을 현재 카탈로그에서 찾을 수 없어요." };
  }
  const visaCountry = category.id === "visa" ? visaCountries.find((item) => item.id === input.visaCountryId) : null;
  if (category.id === "visa" && !visaCountry) return { success: false, error: "비자 국가를 선택해 주세요." };
  if (category.id !== "visa" && input.visaCountryId !== null) return { success: false, error: "비자 국가 선택이 필요하지 않은 상품이에요." };
  if (hasDuplicates(input.addonIds) || input.addonIds.some((id) => !product.allowedAddonIds.includes(id) || !catalog.addons.some((item) => item.id === id && item.active))) {
    return { success: false, error: "선택할 수 없는 추가 옵션이 포함되어 있어요." };
  }
  for (const addonId of input.addonIds) {
    const addon = catalog.addons.find((item) => item.id === addonId)!;
    if (input.addonIds.some((otherId) => addon.excludes.includes(otherId))) return { success: false, error: "함께 선택할 수 없는 옵션이 포함되어 있어요." };
  }
  if (hasDuplicates(input.discountIds) || input.discountIds.some((id) => !catalog.discounts.some((item) => item.id === id && item.active))) {
    return { success: false, error: "선택할 수 없는 할인이 포함되어 있어요." };
  }
  if (catalog.discountPolicy === "single" && input.discountIds.length > 1) return { success: false, error: "할인은 하나만 선택할 수 있어요." };
  const pickup = catalog.pickups.find((item) => item.id === input.pickupId && item.active);
  if (!pickup || !product.allowedPickupIds.includes(pickup.id)) return { success: false, error: "이 상품에서 선택할 수 없는 수령시간이에요." };

  const price = calculatePrice(catalog, product, input);
  return {
    success: true,
    submission: {
      ...input,
      expectedTotal: price.total,
      selectionSnapshot: {
        categoryName: category.name,
        tierName: tier.name,
        productName: product.name,
        productPrice: product.price,
        addons: input.addonIds.map((id) => { const item = catalog.addons.find((addon) => addon.id === id)!; return { id: item.id, name: item.name, price: getAddonPrice(catalog, product, item.id) }; }),
        discounts: input.discountIds.map((id) => { const item = catalog.discounts.find((discount) => discount.id === id)!; return { id: item.id, name: item.name, amount: item.amount, requiresStaffApproval: item.requiresStaffApproval }; }),
        reviewParticipation: input.reviewParticipation,
        sampleConsent: input.sampleConsent,
        monthlyEventEligible: input.sampleConsent && input.reviewParticipation,
        monthlyEventBenefit: input.sampleConsent && input.reviewParticipation ? "헤어·의상 교체 제공" : null,
        ...(visaCountry ? { visaCountryId: visaCountry.id, visaCountryName: visaCountry.name, visaCountrySize: visaCountry.size, visaCountryNote: visaCountry.note } : {}),
        pickup: { id: pickup.id, name: pickup.name, surcharge: pickup.surcharge },
      },
    },
  };
}




