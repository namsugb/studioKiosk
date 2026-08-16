import { KioskGate } from "./kiosk-gate";
import { defaultCatalog } from "@/lib/catalog/defaults";

export const dynamic = "force-dynamic";
export default function KioskPage() { return <KioskGate initialCatalog={defaultCatalog} />; }
