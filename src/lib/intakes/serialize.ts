import type { IntakeRecord } from "./types";

type DatabaseIntakeLine = {
  line_type?: unknown;
  reference_id?: unknown;
  staff_approved?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

export function serializeDatabaseIntake(value: unknown): IntakeRecord {
  const row = value as Record<string, unknown>;
  const lines = Array.isArray(row.intake_lines)
    ? (row.intake_lines as DatabaseIntakeLine[])
    : [];
  const snapshot = row.selection_snapshot && typeof row.selection_snapshot === "object"
    ? (row.selection_snapshot as Record<string, unknown>)
    : {};

  return {
    id: text(row.id),
    intakeNumber: text(row.intake_number),
    organizationId: text(row.organization_id),
    storeId: text(row.store_id),
    status: row.status as IntakeRecord["status"],
    clientSubmissionId: text(row.client_submission_id),
    catalogReleaseId: text(row.catalog_release_ref),
    categoryId: text(row.category_id),
    tierId: text(row.tier_id),
    productId: text(row.product_id),
    addonIds: lines.filter((line) => line.line_type === "addon").map((line) => text(line.reference_id)),
    discountIds: lines.filter((line) => line.line_type === "discount").map((line) => text(line.reference_id)),
    discountApprovedIds: lines.filter((line) => line.line_type === "discount" && line.staff_approved === true).map((line) => text(line.reference_id)),
    reviewParticipation: snapshot.reviewParticipation === true,
    visaCountryId: text(snapshot.visaCountryId) || null,
    pickupId: text(row.pickup_id),
    customer: {
      name: text(row.customer_name),
      phone: text(row.customer_phone),
      request: text(row.customer_request),
    },
    privacyConsent: true,
    expectedTotal: nullableNumber(row.expected_total),
    finalTotal: nullableNumber(row.final_total),
    selectionSnapshot: snapshot,
    needsReview: row.needs_review === true,
    internalNote: text(row.internal_note),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}



