import { createClient } from "@/lib/supabase/server";
import { DateText } from "@/components/date-text";
import MyScheduleClient from "./my-schedule-client";

export default async function MySchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: period } = await supabase
    .from("schedule_periods")
    .select("*")
    .eq("status", "published")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!period) {
    return (
      <div className="rounded border border-border bg-surface p-6 text-center">
        <h1 className="mb-2 text-xl font-bold">השיבוץ שלי</h1>
        <p className="text-text-muted">אין עדיין שיבוץ מפורסם.</p>
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
  const safeInstanceIds = instanceIds.length > 0 ? instanceIds : ["00000000-0000-0000-0000-000000000000"];

  // RLS now exposes every assignment/availability row for a published
  // period's shifts to any logged-in employee (not just their own), so
  // coworkers and swap candidates can be computed here.
  const [{ data: allAssignments }, { data: allAvailability }, { data: employees }] = await Promise.all([
    supabase.from("assignments").select("*").in("shift_instance_id", safeInstanceIds),
    supabase.from("availability").select("*").in("shift_instance_id", safeInstanceIds).eq("is_available", true),
    supabase.from("employees").select("id, full_name").eq("active", true),
  ]);

  const nameById = new Map((employees ?? []).map((e) => [e.id, e.full_name]));
  const myShiftIds = new Set(
    (allAssignments ?? []).filter((a) => a.employee_id === user!.id).map((a) => a.shift_instance_id)
  );
  const myShifts = (instances ?? []).filter((i) => myShiftIds.has(i.id));

  const shiftsWithExtras = myShifts.map((shift) => {
    const assignedIds = new Set(
      (allAssignments ?? []).filter((a) => a.shift_instance_id === shift.id).map((a) => a.employee_id)
    );
    const coworkers = [...assignedIds]
      .filter((id) => id !== user!.id)
      .map((id) => nameById.get(id))
      .filter((name): name is string => Boolean(name));

    const swapCandidates = (allAvailability ?? [])
      .filter((a) => a.shift_instance_id === shift.id && !assignedIds.has(a.employee_id))
      .map((a) => nameById.get(a.employee_id))
      .filter((name): name is string => Boolean(name));

    return { shift, coworkers, swapCandidates };
  });

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">
        השיבוץ שלי — <DateText date={period.start_date} /> עד <DateText date={period.end_date} />
      </h1>

      {myShifts.length === 0 ? (
        <p className="mt-4 text-text-muted">לא שובצת למשמרות במחזור הזה.</p>
      ) : (
        <MyScheduleClient shifts={shiftsWithExtras} />
      )}
    </div>
  );
}
