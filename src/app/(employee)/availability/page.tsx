import { createClient } from "@/lib/supabase/server";
import AvailabilityClient from "./availability-client";

export default async function AvailabilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: period } = await supabase
    .from("schedule_periods")
    .select("*")
    .in("status", ["collecting", "generated"])
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!period) {
    return (
      <div className="rounded border border-border bg-surface p-6 text-center">
        <h1 className="mb-2 text-xl font-bold">הגשת זמינות</h1>
        <p className="text-text-muted">אין כרגע מחזור פתוח להגשת זמינות.</p>
      </div>
    );
  }

  const { data: instances } = await supabase
    .from("shift_instances")
    .select("*")
    .eq("schedule_period_id", period.id)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  const instanceIds = (instances ?? []).map((i) => i.id);

  const { data: availability } = await supabase
    .from("availability")
    .select("*")
    .eq("employee_id", user!.id)
    .in("shift_instance_id", instanceIds.length > 0 ? instanceIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: request } = await supabase
    .from("weekly_shift_requests")
    .select("*")
    .eq("employee_id", user!.id)
    .eq("schedule_period_id", period.id)
    .maybeSingle();

  return (
    <AvailabilityClient
      period={period}
      instances={instances ?? []}
      initialAvailability={availability ?? []}
      initialDesiredCount={request?.desired_shift_count ?? null}
    />
  );
}
