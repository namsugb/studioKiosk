import { describe, expect, it } from "vitest";
import { serializeDatabaseIntake } from "./serialize";

describe("serializeDatabaseIntake", () => {
  it("maps Supabase columns and discount approvals to the staff shape", () => {
    const intake = serializeDatabaseIntake({
      id: "intake-id",
      intake_number: "A-023",
      organization_id: "org-id",
      store_id: "store-id",
      status: "pending_review",
      client_submission_id: "submission-id",
      catalog_release_ref: "release-v1",
      category_id: "id",
      tier_id: "basic",
      product_id: "id-basic",
      pickup_id: "fast",
      customer_name: "김민지",
      customer_phone: "01012345678",
      customer_request: "민증용",
      expected_total: 55_000,
      final_total: null,
      selection_snapshot: { productName: "증명사진 기본 보정", reviewParticipation: true },
      needs_review: false,
      created_at: "2026-08-14T00:00:00.000Z",
      updated_at: "2026-08-14T00:00:00.000Z",
      intake_lines: [
        { line_type: "addon", reference_id: "extra-print" },
        { line_type: "discount", reference_id: "student", staff_approved: true },
      ],
    });

    expect(intake.intakeNumber).toBe("A-023");
    expect(intake.addonIds).toEqual(["extra-print"]);
    expect(intake.discountIds).toEqual(["student"]);
    expect(intake.discountApprovedIds).toEqual(["student"]);
    expect(intake.reviewParticipation).toBe(true);
  });
});

