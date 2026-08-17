import { jwtVerify, SignJWT } from "jose";

declare global { var __studioKioskDevSecret: string | undefined; }
function sessionSecret() {
  const configured = process.env.STAFF_SESSION_SECRET;
  if (configured?.length && configured.length >= 32) return new TextEncoder().encode(configured);
  if (process.env.NODE_ENV === "production") throw new Error("STAFF_SESSION_SECRET is missing");
  globalThis.__studioKioskDevSecret ??= crypto.randomUUID() + crypto.randomUUID();
  return new TextEncoder().encode(globalThis.__studioKioskDevSecret);
}
export type StaffSession = { storeId: string; deviceId: string; role: "staff"; canManageCatalog: boolean };
export async function signStaffSession(payload: StaffSession) { return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(sessionSecret()); }
export async function verifyStaffSession(token?: string | null): Promise<StaffSession | null> { if (!token) return null; try { const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] }); if (payload.role !== "staff") return null; return { storeId: String(payload.storeId), deviceId: String(payload.deviceId), role: "staff", canManageCatalog: payload.canManageCatalog === true }; } catch { return null; } }