import { createClient } from "@/lib/supabase/server";
import PlanningAheadClient from "./planning-ahead-client";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function PlanningAheadPage() {
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: entries }, { data: employees }] = await Promise.all([
    supabase
      .from("employee_unavailability")
      .select("*")
      .gte("end_date", today)
      .order("start_date", { ascending: true }),
    supabase.from("employees").select("*"),
  ]);

  return <PlanningAheadClient initialEntries={entries ?? []} employees={employees ?? []} />;
}
