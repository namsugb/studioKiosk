import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/config";
import { createServerSupabase } from "@/lib/supabase/server";
import { OpsApp } from "./ops-app";

export const dynamic = "force-dynamic";
export default async function OpsPage() {
  if (!isDemoMode) { const supabase = await createServerSupabase(); if (!supabase) redirect("/ops/login"); const { data } = await supabase.auth.getUser(); if (!data.user) redirect("/ops/login"); }
  return <OpsApp/>;
}
