export const visaCountries = [
  { id: "us", name: "미국", size: "51 × 51 mm (2 × 2 inch)", note: "최근 6개월 이내 촬영 · 안경 착용 불가" },
  { id: "japan", name: "일본", size: "45 × 35 mm", note: "최근 6개월 이내 촬영 · 정면 무표정" },
  { id: "china", name: "중국", size: "33 × 48 mm", note: "최근 6개월 이내 촬영 · 양쪽 귀 노출 권장" },
  { id: "eu", name: "EU", size: "35 × 45 mm", note: "최근 6개월 이내 촬영 · 얼굴 비율 규정이 엄격하며 국가별 미세 차이가 있어요." },
  { id: "canada", name: "캐나다", size: "50 × 70 mm", note: "최근 6개월 이내 촬영" },
] as const;

export type VisaCountryId = (typeof visaCountries)[number]["id"];
