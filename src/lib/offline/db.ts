import { openDB, type DBSchema } from "idb";
import type { Catalog } from "@/lib/catalog/schema";
import type { IntakeSubmission } from "@/lib/intakes/types";

interface StudioKioskDb extends DBSchema {
  catalog: { key: string; value: Catalog };
  outbox: { key: string; value: { submission: IntakeSubmission; queuedAt: string; attempts: number } };
}

const getDb = () => openDB<StudioKioskDb>("studio-kiosk", 1, { upgrade(db) { db.createObjectStore("catalog"); db.createObjectStore("outbox"); } });
export async function cacheCatalog(catalog: Catalog) { return (await getDb()).put("catalog", catalog, "current"); }
export async function getCachedCatalog() { return (await getDb()).get("catalog", "current"); }
export async function queueIntake(submission: IntakeSubmission) { return (await getDb()).put("outbox", { submission, queuedAt: new Date().toISOString(), attempts: 0 }, submission.clientSubmissionId); }
export async function flushOutbox(accessToken?: string | null) {
  const db = await getDb();
  const all = await db.getAll("outbox");
  for (const queued of all) {
    try {
      const response = await fetch("/api/intakes", { method: "POST", headers: { "content-type": "application/json", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify(queued.submission) });
      if (response.ok) await db.delete("outbox", queued.submission.clientSubmissionId);
      else await db.put("outbox", { ...queued, attempts: queued.attempts + 1 }, queued.submission.clientSubmissionId);
    } catch { await db.put("outbox", { ...queued, attempts: queued.attempts + 1 }, queued.submission.clientSubmissionId); }
  }
}

