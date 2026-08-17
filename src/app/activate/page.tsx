import { redirect } from "next/navigation";
import { DeviceActivation } from "./device-activation";

export default function ActivatePage() {
  if (process.env.NODE_ENV === "development") redirect("/kiosk");
  return <DeviceActivation/>;
}
