import { describe, expect, it } from "vitest";
import { defaultCatalog } from "./defaults";
import { calculatePrice, normalizeAddonSelection, normalizeDiscountSelection } from "./calculate";

describe("catalog price rules", () => {
  const product = defaultCatalog.products.find((item) => item.id === "id-basic")!;
  it("calculates addons and requested discounts", () => {
    expect(calculatePrice(defaultCatalog, product, { addonIds: ["extra-file"], discountIds: ["student"], pickupId: "fast" })).toEqual({ base: 30000, addonTotal: 5000, discountTotal: 5000, pickupSurcharge: 0, total: 30000 });
  });
  it("replaces separate hair choices with the combined option", () => {
    expect(normalizeAddonSelection(defaultCatalog, ["costume", "hair"], "costume-hair")).toEqual(["costume-hair"]);
  });
  it("toggles the remaining student discount", () => {
    expect(normalizeDiscountSelection(defaultCatalog, [], "student")).toEqual(["student"]);
  });
  it("allows multiple print formats and charges 15,000 won for each", () => {
    const printAddonIds = ["extra-print-3x4", "extra-print-35x45", "extra-print-visa", "extra-print-card"];
    expect(printAddonIds.every((id) => product.allowedAddonIds.includes(id))).toBe(true);
    expect(normalizeAddonSelection(defaultCatalog, printAddonIds.slice(0, 2), printAddonIds[2])).toEqual(printAddonIds.slice(0, 3));
    expect(calculatePrice(defaultCatalog, product, { addonIds: printAddonIds, discountIds: [], pickupId: "fast" })).toMatchObject({ addonTotal: 60000, total: 90000 });
  });
  it("uses the configured premium price", () => {
    const premium = defaultCatalog.products.find((item) => item.id === "id-premium")!;
    expect(calculatePrice(defaultCatalog, premium, { addonIds: [], discountIds: [], pickupId: "consult" }).total).toBe(60000);
  });
  it("matches the configured category price matrix", () => {
    const prices = Object.fromEntries(defaultCatalog.products.map((item) => [item.id, item.price.amount]));
    expect(prices).toMatchObject({
      "id-basic": 30000, "id-advanced": 45000, "id-premium": 60000,
      "resident-basic": 30000, "resident-advanced": 45000, "resident-premium": 60000,
      "passport-basic": 30000, "passport-advanced": 45000, "passport-premium": 60000,
      "job-advanced": 55000, "job-premium": 77000, "job-cabin-crew": 99000,
      "visa-basic": 45000, "visa-advanced": 60000,
      "profile-basic": 70000, "profile-advanced": 150000, "profile-premium": 250000,
    });
  });
  it("uses 15~20 minutes for basic and advanced ID and passport products", () => {
    const matchingProducts = defaultCatalog.products.filter((item) => ["id", "resident", "passport"].includes(item.categoryId) && (item.tierId === "basic" || item.tierId === "advanced"));
    expect(matchingProducts).toHaveLength(6);
    for (const item of matchingProducts) {
      expect(item.durationMinutes).toBeNull();
      expect(item.durationLabel).toBe("약 15~20분");
    }

    const otherBasic = defaultCatalog.products.filter((item) => !["id", "resident", "passport", "profile"].includes(item.categoryId) && item.tierId === "basic");
    const otherAdvanced = defaultCatalog.products.filter((item) => !["id", "resident", "passport", "job", "profile"].includes(item.categoryId) && item.tierId === "advanced");
    expect(otherBasic.every((item) => item.durationMinutes === 30 && item.durationLabel === undefined)).toBe(true);
    expect(otherAdvanced.every((item) => item.durationMinutes === 60 && item.durationLabel === undefined)).toBe(true);
  });
  it("includes file delivery in document premium products", () => {
    for (const productId of ["id-premium", "resident-premium", "passport-premium"]) {
      const product = defaultCatalog.products.find((item) => item.id === productId)!;
      expect(product.details).toContain("수정본 파일 제공");
      expect(product.includedAddonIds).toContain("extra-file");
      expect(product.details).toContain("헤어스타일 & 의상 교체");
      expect(product.details).not.toContain("헤어스타일 변경");
      expect(product.details).not.toContain("의상 교체");
    }
  });
  it("omits file delivery from standard document basic products", () => {
    for (const productId of ["id-basic", "resident-basic", "passport-basic", "visa-basic"]) {
      const product = defaultCatalog.products.find((item) => item.id === productId)!;
      expect(product.details).toContain("출력물 제공");
      expect(product.details).not.toContain("제출용 파일과 출력물 제공");
    }
  });
  it("adds print quantity and size details to every ID and passport product", () => {
    const matchingProducts = defaultCatalog.products.filter((item) => ["id", "resident", "passport"].includes(item.categoryId));
    expect(matchingProducts).toHaveLength(9);
    for (const item of matchingProducts) expect(item.details).toContain("출력 6매");
    expect(matchingProducts.filter((item) => item.categoryId === "id").every((item) => item.details.includes("규격 3 × 4 cm"))).toBe(true);
    expect(matchingProducts.filter((item) => item.categoryId !== "id").every((item) => item.details.includes("규격 3.5 × 4.5 cm"))).toBe(true);
  });  it("configures the job products and includes the retouched file", () => {
    const advanced = defaultCatalog.products.find((item) => item.id === "job-advanced")!;
    expect(advanced.details).toEqual(["3 × 4 8매", "3.5 × 4.5 6매", "수정본 파일 제공 (3 × 4)"]);
    expect(advanced.durationLabel).toBe("1시간");
    expect(advanced.allowedAddonIds).not.toContain("extra-file");
    expect(advanced.includedAddonIds).toContain("extra-file");

    const premium = defaultCatalog.products.find((item) => item.id === "job-premium")!;
    expect(premium.details).toEqual(["헤어·의상 교체 포함", "3 × 4 8매", "3.5 × 4.5 6매", "수정본 파일 2종 포함 (3 × 4, 3.5 × 4.5)"]);
    expect(premium.durationLabel).toBe("최소 2시간 · 정확한 시간은 직원과 상담해요.");
    expect(premium.allowedAddonIds).not.toContain("extra-file");
    expect(premium.includedAddonIds).toEqual(expect.arrayContaining(["costume-hair", "extra-file"]));

    const cabinCrew = defaultCatalog.products.find((item) => item.id === "job-cabin-crew")!;
    expect(cabinCrew.details).toEqual(["헤어·의상 교체 포함", "올림머리 헤어스타일링", "치아 보이는 웃는 모습", "3 × 4 8매", "3.5 × 4.5 6매", "수정본 파일 2종 포함 (3 × 4, 3.5 × 4.5)"]);
    expect(cabinCrew.durationMinutes).toBeNull();
    expect(cabinCrew.durationLabel).toBeUndefined();
    expect(cabinCrew.allowedAddonIds).not.toContain("extra-file");
    expect(cabinCrew.includedAddonIds).toEqual(expect.arrayContaining(["costume-hair", "extra-file"]));
  });  it("configures profile packages and charges 30,000 won per extra file", () => {
    const basic = defaultCatalog.products.find((item) => item.id === "profile-basic")!;
    expect(basic.details).toEqual(["출력 규격 4 x 6", "의상 1벌", "파일 1개 제공"]);
    expect(basic.durationLabel).toBe("1시간");
    expect(calculatePrice(defaultCatalog, basic, { addonIds: ["extra-file"], discountIds: [], pickupId: "fast" })).toMatchObject({ base: 70000, addonTotal: 30000, total: 100000 });

    const advanced = defaultCatalog.products.find((item) => item.id === "profile-advanced")!;
    expect(advanced.details).toEqual(["출력 규격 4 x 6", "의상 2벌", "파일 2개 제공"]);
    expect(advanced.durationLabel).toBe("2시간");

    const premium = defaultCatalog.products.find((item) => item.id === "profile-premium")!;
    expect(premium.details).toEqual(["헤어·의상 교체 없음", "의상 2벌 촬영", "다른 포즈 파일 4개 제공", "출력물 4 x 6 2매"]);
    expect(premium.durationLabel).toBeUndefined();
    expect(premium.includedAddonIds).not.toContain("costume-hair");
    expect(premium.tierSubtitle).toBe("의상 2벌 · 파일 4개");
  });  it("omits unavailable branches and exposes the job cabin crew shell", () => {
    expect(defaultCatalog.products.some((item) => item.id === "job-basic")).toBe(false);
    expect(defaultCatalog.products.some((item) => item.id === "visa-premium")).toBe(false);
    expect(defaultCatalog.products.find((item) => item.id === "job-cabin-crew")?.price.amount).toBe(99000);
  });
});













