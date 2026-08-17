import type { Catalog } from "./schema";

const printAddonIds = ["extra-print-3x4", "extra-print-35x45", "extra-print-visa", "extra-print-card"];
const standardAddons = ["extra-file", ...printAddonIds];
const pickups = ["fast", "same-day", "consult"];

const categorySeed = [
  ["id", "학생증 자격증 이력서", "3 × 4 cm", "id-card", 30000, 45000, 60000],
  ["resident", "민증", "3.5 × 4.5 cm", "id-card", 30000, 45000, 60000],
  ["passport", "운전면허, 여권, 수능", "3.5 × 4.5 cm", "scan-face", 30000, 45000, 60000],
  ["job", "취업", "3 × 4 cm · 3.5 × 4.5 cm · 2종 제공", "briefcase-business", null, 55000, 77000],
  ["visa", "비자", "국가별 규격", "plane", 45000, 60000, null],
  ["profile", "프로필", "4 × 6 inch", "user-round", 70000, 150000, 250000]
] as const;

function buildProducts(): Catalog["products"] {
  return categorySeed.flatMap(([categoryId, categoryName, , , basic, advanced, premium]) => {
    const products: Catalog["products"] = [];
    const usesIdPhotoDetails = categoryId === "id" || categoryId === "resident" || categoryId === "passport";
    const isJob = categoryId === "job";
    const isProfile = categoryId === "profile";
    const categoryDetails = categoryId === "id" ? ["출력 6매", "규격 3 × 4 cm"] : categoryId === "resident" || categoryId === "passport" ? ["출력 6매", "규격 3.5 × 4.5 cm"] : [];
    const profileAddonPriceOverrides = isProfile ? { "extra-file": 30000 } : undefined;
    const basicDeliveryDetail = "출력물 제공";

    if (basic !== null) products.push({
      id: `${categoryId}-basic`, categoryId, tierId: "basic", name: `${categoryName} 기본 보정`, tag: isProfile ? "의상 1벌 · 파일 1개 제공" : "자연스러운 기본 보정 상품", price: { amount: basic },
      details: isProfile ? ["출력 규격 4 x 6", "의상 1벌", "파일 1개 제공"] : [...categoryDetails, "다양한 표정과 각도로 촬영", "피부톤·잡티·다크서클 자연 보정", basicDeliveryDetail],
      durationMinutes: usesIdPhotoDetails || isProfile ? null : 30,
      durationLabel: usesIdPhotoDetails ? "약 15~20분" : isProfile ? "1시간" : undefined,
      addonPriceOverrides: profileAddonPriceOverrides,
      tierSubtitle: isProfile ? "의상 1벌 · 파일 1개" : undefined,
      tierDescription: isProfile ? "4 x 6 규격으로 촬영하고 파일 1개를 제공해요." : undefined,
      tierFeatures: isProfile ? ["의상 1벌", "파일 1개 제공", "소요시간 1시간"] : undefined,
      allowedAddonIds: standardAddons, includedAddonIds: [], allowedPickupIds: pickups, active: true,
    });

    products.push({
      id: `${categoryId}-advanced`, categoryId, tierId: "advanced", name: `${categoryName} 고급 보정`, tag: isProfile ? "의상 2벌 · 파일 2개 제공" : "디지털 메이크업과 1:1 수정 확인", price: { amount: advanced },
      details: isProfile ? ["출력 규격 4 x 6", "의상 2벌", "파일 2개 제공"] : isJob ? ["3 × 4 8매", "3.5 × 4.5 6매", "수정본 파일 제공 (3 × 4)"] : [...categoryDetails, "촬영 전 이미지 상담", "디지털 메이크업과 비대칭 세부 조정", "고객과 1:1 수정 확인"],
      durationMinutes: usesIdPhotoDetails || isJob || isProfile ? null : 60,
      durationLabel: usesIdPhotoDetails ? "약 15~20분" : isJob ? "1시간" : isProfile ? "2시간" : undefined,
      addonPriceOverrides: profileAddonPriceOverrides,
      tierSubtitle: isProfile ? "의상 2벌 · 파일 2개" : undefined,
      tierDescription: isProfile ? "두 가지 의상으로 촬영하고 파일 2개를 제공해요." : undefined,
      tierFeatures: isProfile ? ["의상 2벌", "파일 2개 제공", "소요시간 2시간"] : undefined,
      allowedAddonIds: isJob ? printAddonIds : standardAddons,
      includedAddonIds: isJob ? ["extra-file"] : [],
      allowedPickupIds: ["same-day", "consult"], active: true,
    });

    if (premium !== null) products.push({
      id: `${categoryId}-premium`, categoryId, tierId: "premium", name: `${categoryName} 프리미엄 보정`, tag: isProfile ? "의상 2벌 · 다른 포즈 파일 4개" : "헤어·의상 교체 프리미엄 상품", price: { amount: premium },
      details: isProfile ? ["헤어·의상 교체 없음", "의상 2벌 촬영", "다른 포즈 파일 4개 제공", "출력물 4 x 6 2매"] : isJob ? ["헤어·의상 교체 포함", "3 × 4 8매", "3.5 × 4.5 6매", "수정본 파일 2종 포함 (3 × 4, 3.5 × 4.5)"] : [...categoryDetails, ...(usesIdPhotoDetails ? ["수정본 파일 제공"] : []), "고급 보정 전체 포함", "헤어스타일 & 의상 교체", "촬영 목적에 맞춘 정밀 보정"],
      durationMinutes: null,
      durationLabel: isJob ? "최소 2시간 · 정확한 시간은 직원과 상담해요." : undefined,
      addonPriceOverrides: profileAddonPriceOverrides,
      tierSubtitle: isProfile ? "의상 2벌 · 파일 4개" : undefined,
      tierDescription: isProfile ? "의상 2벌로 촬영하고 서로 다른 포즈의 파일 4개를 제공해요." : undefined,
      tierFeatures: isProfile ? ["의상 2벌 촬영", "파일 4개 제공", "4 x 6 출력물 2매"] : undefined,
      allowedAddonIds: isJob ? printAddonIds : standardAddons,
      includedAddonIds: isJob ? ["costume-hair", "extra-file"] : usesIdPhotoDetails ? ["costume-hair", "extra-file"] : isProfile ? [] : ["costume-hair"],
      allowedPickupIds: ["consult"], active: true,
    });

    if (isJob) products.push({
      id: "job-cabin-crew", categoryId, tierId: "cabin-crew", name: "취업사진 승무원", tag: "승무원 지원용 촬영 상품", price: { amount: 99000 },
      details: ["헤어·의상 교체 포함", "올림머리 헤어스타일링", "치아 보이는 웃는 모습", "3 × 4 8매", "3.5 × 4.5 6매", "수정본 파일 2종 포함 (3 × 4, 3.5 × 4.5)"],
      durationMinutes: null, allowedAddonIds: printAddonIds, includedAddonIds: ["costume-hair", "extra-file"], allowedPickupIds: ["consult"], active: true,
    });

    return products;
  });
}
export const defaultCatalog: Catalog = {
  schemaVersion: 1,
  releaseId: "demo-release-v1",
  version: 1,
  publishedAt: "2026-08-14T00:00:00.000Z",
  studio: {
    name: "순천사진관 나다움",
    tagline: "사진 종류와 원하는 보정을 선택하면 상품과 가격을 바로 확인할 수 있어요.",
    primaryColor: "#3182F6",
    supportCopy: "궁금하신 사항이 있으시면 직원에게 편하게 문의해 주세요.",
    privacyRetentionDays: 7
  },
  categories: categorySeed.map(([id, name, description, icon], order) => ({ id, name, description, icon, order, active: true })),
  tiers: [
    { id: "basic", name: "기본 보정", subtitle: "자연스러운 기본 정리", description: "본래 인상을 유지하면서 깔끔하게 정리해요.", features: ["피부톤·잡티", "다크서클", "잔머리·옷매무새"], order: 0 },
    { id: "advanced", name: "고급 보정", subtitle: "디지털 메이크업", description: "디지털 메이크업과 세부 보정을 더해요.", features: ["기본 보정 포함", "디지털 메이크업", "비대칭 세부 조정", "1:1 수정 확인"], order: 1 },
    { id: "premium", name: "프리미엄 보정", subtitle: "헤어·의상 교체", description: "헤어와 의상까지 촬영 목적에 맞게 변경해요.", features: ["고급 보정 포함", "헤어 교체", "의상 교체", "정밀 보정"], order: 2 },
    { id: "cabin-crew", name: "승무원", subtitle: "승무원 지원용", description: "헤어스타일링과 승무원 지원용 표정 촬영을 진행해요.", features: ["올림머리 헤어스타일링", "치아 보이는 웃는 모습", "수정본 파일 포함"], order: 3 }
  ],
  products: buildProducts(),
  addons: [
    { id: "extra-file", name: "파일 추가", description: "제출용 파일을 추가해요.", price: 5000, conflictGroup: null, excludes: [], active: true },
    { id: "extra-print-3x4", name: "3 × 4 인화 추가", description: "3 × 4 규격으로 8매를 추가해요.", price: 15000, conflictGroup: null, excludes: [], active: true },
    { id: "extra-print-35x45", name: "3.5 × 4.5 인화 추가", description: "3.5 × 4.5 규격으로 6매를 추가해요.", price: 15000, conflictGroup: null, excludes: [], active: true },
    { id: "extra-print-visa", name: "비자사진 인화 추가", description: "비자사진 규격으로 4매를 추가해요.", price: 15000, conflictGroup: null, excludes: [], active: true },
    { id: "extra-print-card", name: "명함사진 인화 추가", description: "명함사진 규격으로 2매를 추가해요.", price: 15000, conflictGroup: null, excludes: [], active: true },
    { id: "costume", name: "의상 합성", description: "목적에 맞는 의상으로 변경해요.", price: 15000, conflictGroup: "appearance", excludes: ["costume-hair"], active: true },
    { id: "hair", name: "헤어 합성", description: "헤어스타일을 자연스럽게 변경해요.", price: 25000, conflictGroup: "appearance", excludes: ["costume-hair"], active: true },
    { id: "costume-hair", name: "의상+헤어 합성", description: "의상과 헤어를 함께 변경해요.", price: 30000, conflictGroup: "appearance-combined", excludes: ["costume", "hair"], active: true }
  ],
  discounts: [
    { id: "student", name: "학생 할인", description: "결제할 때 학생 여부를 확인해요.", amount: 5000, requiresStaffApproval: true, active: true }
  ],
  discountPolicy: "stackable",
  pickups: [
    { id: "fast", name: "빠른 수령", description: "촬영 후 15분 이내 희망", surcharge: 0, active: true },
    { id: "same-day", name: "당일 수령", description: "촬영 후 2시간 이후", surcharge: 0, active: true },
    { id: "consult", name: "시간 협의", description: "직원과 가능한 시간을 정해요.", surcharge: 0, active: true }
  ]
};







