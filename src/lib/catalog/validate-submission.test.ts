import { describe, expect, it } from "vitest";
import { defaultCatalog } from "./defaults";
import { validateSubmissionAgainstCatalog } from "./validate-submission";
import type { IntakeSubmission } from "@/lib/intakes/types";

const baseSubmission: IntakeSubmission = {
  clientSubmissionId: "8aa7fd93-ebf7-4d52-a868-8e51001a0523",
  catalogReleaseId: defaultCatalog.releaseId,
  categoryId: "id",
  tierId: "basic",
  productId: "id-basic",
  addonIds: ["extra-print"],
  discountIds: ["student"], reviewParticipation: false, visaCountryId: null,
  pickupId: "fast",
  customer: { name: "김민지", phone: "01012345678", request: "" },
  privacyConsent: true,
  expectedTotal: 0,
  selectionSnapshot: { forged: true },
};

describe("validateSubmissionAgainstCatalog", () => {
  it("recalculates a client supplied total and canonical snapshot", () => {
    const result = validateSubmissionAgainstCatalog(defaultCatalog, baseSubmission);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.submission.expectedTotal).toBe(40_000);
    expect(result.submission.selectionSnapshot).not.toHaveProperty("forged");
    expect(result.submission.selectionSnapshot.productName).toBe("증명사진 기본 보정");
  });

  it("rejects the retired review discount", () => {
    const result = validateSubmissionAgainstCatalog(defaultCatalog, { ...baseSubmission, discountIds: ["review"] });
    expect(result.success).toBe(false);
  });

  it("rejects add-ons that are not allowed by a product", () => {
    const result = validateSubmissionAgainstCatalog(defaultCatalog, { ...baseSubmission, tierId: "premium", productId: "id-premium", addonIds: ["hair"], pickupId: "consult" });
    expect(result.success).toBe(false);
  });

  it("rejects hair and costume synthesis add-ons outside premium products", () => {
    for (const addonId of ["costume", "hair", "costume-hair"]) {
      const result = validateSubmissionAgainstCatalog(defaultCatalog, { ...baseSubmission, addonIds: [addonId] });
      expect(result.success).toBe(false);
    }
  });

  it("requires and snapshots a country for visa products", () => {
    const visaSubmission = { ...baseSubmission, categoryId: "visa", tierId: "basic", productId: "visa-basic", addonIds: [], discountIds: [], pickupId: "fast" };
    expect(validateSubmissionAgainstCatalog(defaultCatalog, visaSubmission).success).toBe(false);

    const result = validateSubmissionAgainstCatalog(defaultCatalog, { ...visaSubmission, visaCountryId: "us" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.submission.selectionSnapshot).toMatchObject({ visaCountryId: "us", visaCountryName: "미국", visaCountrySize: "51 × 51 mm (2 × 2 inch)" });
  });
  it("snapshots the profile-specific extra file price", () => {
    const result = validateSubmissionAgainstCatalog(defaultCatalog, { ...baseSubmission, categoryId: "profile", tierId: "basic", productId: "profile-basic", addonIds: ["extra-file"], discountIds: [], visaCountryId: null, pickupId: "fast" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.submission.expectedTotal).toBe(100000);
    expect(result.submission.selectionSnapshot).toMatchObject({ addons: [{ id: "extra-file", name: "추가 파일", price: 30000 }] });
  });
  it("rejects pickup times outside the product policy", () => {
    const result = validateSubmissionAgainstCatalog(defaultCatalog, { ...baseSubmission, tierId: "advanced", productId: "id-advanced", pickupId: "fast" });
    expect(result.success).toBe(false);
  });
});







