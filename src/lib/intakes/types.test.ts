import { describe, expect, it } from "vitest";
import { intakeSubmissionSchema } from "./types";

const valid = {
  clientSubmissionId: "50f48a17-0bc5-453d-8a73-07cc2614077e", catalogReleaseId: "release-v1", categoryId: "id", tierId: "basic", productId: "id-basic", addonIds: [], discountIds: [], reviewParticipation: true, sampleConsent: false, visaCountryId: null, pickupId: "fast",
  customer: { name: "홍길동", phone: "01012345678", request: "" }, privacyConsent: true, expectedTotal: 30000, selectionSnapshot: { productName: "증명사진 기본 보정" }
};

describe("intake validation", () => {
  it("accepts a valid on-site intake", () => expect(intakeSubmissionSchema.safeParse(valid).success).toBe(true));
  it("rejects an invalid phone number", () => expect(intakeSubmissionSchema.safeParse({ ...valid, customer: { ...valid.customer, phone: "123" } }).success).toBe(false));
  it("requires explicit privacy consent", () => expect(intakeSubmissionSchema.safeParse({ ...valid, privacyConsent: false }).success).toBe(false));
});



