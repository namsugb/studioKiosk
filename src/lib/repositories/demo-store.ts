import { defaultCatalog } from "@/lib/catalog/defaults";
import type { Catalog } from "@/lib/catalog/schema";
import type { IntakeRecord, IntakeStatus, IntakeSubmission } from "@/lib/intakes/types";

type DemoDb = { intakes: IntakeRecord[]; catalog: Catalog; releases: Catalog[]; organizations: { id: string; name: string; stores: number; devices: number }[]; counter: number };
const now = new Date();
const seedIntakes: IntakeRecord[] = [
  { id: "demo-1", intakeNumber: "A-021", organizationId: "demo-org", storeId: "demo-store", status: "pending_review", finalTotal: null, needsReview: false, createdAt: new Date(now.getTime()-420000).toISOString(), updatedAt: now.toISOString(), clientSubmissionId: "73c45aec-49cb-4ef2-a935-f971ace88989", catalogReleaseId: defaultCatalog.releaseId, categoryId: "id", tierId: "basic", productId: "id-basic", addonIds: ["extra-print"], discountIds: ["student"], reviewParticipation: true, visaCountryId: null, pickupId: "fast", customer: { name: "김민지", phone: "01012345678", request: "민증용으로 부탁드려요." }, privacyConsent: true, expectedTotal: 40000, selectionSnapshot: { productName: "증명사진 기본 보정" } },
  { id: "demo-2", intakeNumber: "A-020", organizationId: "demo-org", storeId: "demo-store", status: "waiting_shoot", finalTotal: 55000, needsReview: false, createdAt: new Date(now.getTime()-1320000).toISOString(), updatedAt: now.toISOString(), clientSubmissionId: "2af3642e-8c1f-488a-85dc-88aef62a22b7", catalogReleaseId: defaultCatalog.releaseId, categoryId: "job", tierId: "advanced", productId: "job-advanced", addonIds: [], discountIds: [], reviewParticipation: false, visaCountryId: null, pickupId: "same-day", customer: { name: "박서준", phone: "01098765432", request: "" }, privacyConsent: true, expectedTotal: 55000, selectionSnapshot: { productName: "취업사진 고급 보정" } }
];
declare global { var __studioKioskDemoDb: DemoDb | undefined; }
export const demoDb: DemoDb = globalThis.__studioKioskDemoDb ?? { intakes: seedIntakes, catalog: defaultCatalog, releases: [defaultCatalog], organizations: [{ id: "demo-org", name: "순천사진관 나다움", stores: 1, devices: 2 }], counter: 22 };
globalThis.__studioKioskDemoDb = demoDb;
export function addDemoIntake(submission: IntakeSubmission) { const existing = demoDb.intakes.find((item) => item.clientSubmissionId === submission.clientSubmissionId); if (existing) return existing; demoDb.counter += 1; const timestamp = new Date().toISOString(); const record: IntakeRecord = { ...submission, id: crypto.randomUUID(), intakeNumber: `A-${String(demoDb.counter).padStart(3,"0")}`, organizationId: "demo-org", storeId: "demo-store", status: "pending_review", finalTotal: null, needsReview: submission.catalogReleaseId !== demoDb.catalog.releaseId, createdAt: timestamp, updatedAt: timestamp }; demoDb.intakes.unshift(record); return record; }
export function updateDemoIntake(id: string, patch: Partial<IntakeRecord>) { const item = demoDb.intakes.find((row) => row.id === id); if (!item) return null; Object.assign(item, patch, { updatedAt: new Date().toISOString() }); return item; }
export function updateDemoStatus(id: string, status: IntakeStatus) { return updateDemoIntake(id, { status }); }





