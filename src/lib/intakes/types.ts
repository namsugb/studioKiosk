import { z } from "zod";

export const intakeStatusSchema = z.enum(["pending_review", "completed"]);
export type IntakeStatus = z.infer<typeof intakeStatusSchema>;

export const intakeSubmissionSchema = z.object({
  clientSubmissionId: z.string().uuid(), catalogReleaseId: z.string(), categoryId: z.string(), tierId: z.string(), productId: z.string(),
  addonIds: z.array(z.string()), discountIds: z.array(z.string()), reviewParticipation: z.boolean().default(false), sampleConsent: z.boolean().default(false), visaCountryId: z.string().nullable().default(null), pickupId: z.string(),
  customer: z.object({ name: z.string().trim().min(2).max(30), phone: z.string().regex(/^01[016789]\d{7,8}$/), request: z.string().max(300).default("") }),
  privacyConsent: z.literal(true), expectedTotal: z.number().int().nonnegative().nullable(), selectionSnapshot: z.record(z.string(), z.unknown())
});
export type IntakeSubmission = z.infer<typeof intakeSubmissionSchema>;

export type IntakeRecord = Omit<IntakeSubmission, "sampleConsent"> & { sampleConsent?: boolean;
  id: string; intakeNumber: string; organizationId: string; storeId: string; status: IntakeStatus; finalTotal: number | null;
  needsReview: boolean; createdAt: string; updatedAt: string; internalNote?: string; discountApprovedIds?: string[];
};

export const statusLabels: Record<IntakeStatus, string> = {
  pending_review: "접수 대기", completed: "접수 완료"
};
