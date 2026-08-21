import { createClient } from "@/lib/supabase/server";
import { DateText } from "@/components/date-text";
import MyScheduleClient from "./my-schedule-client";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function MySchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Every published period that hasn't fully ended yet — not just the
  // latest one — so an employee can see everything upcoming at a glance.
  const { data: periods } = await supabase
    .from("schedule_periods")
    .select("*")
    .eq("status", "published")
    .gte("end_date", todayISO())
    .order("start_date", { ascending: true });

  if (!periods || periods.length === 0) {
    return (
      <div className="rounded border border-border bg-surface p-6 text-center">
        <h1 className="mb-2 text-xl font-bold">השיבוץ שלי</h1>
        <p className="text-text-muted">אין כרגע מחזור מפורסם שעדיין לא הסתיים.</p>
      </div>
    );
  }

  const periodIds = periods.map((p) => p.id);

  const { data: instances } = await supabase
    .from("shift_instances")
    .select("*")
    .in("schedule_period_id", periodIds)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  const instanceIds = (instances ?? []).map((i) => i.id);
  const safeInstanceIds = instanceIds.length > 0 ? instanceIds : ["00000000-0000-0000-0000-000000000000"];

  // RLS exposes every assignment/availability row for a published period's
  // shifts to any logged-in employee (not just their own), so coworkers
  // and swap candidates can be computed here, across all fetched periods.
  const [{ data: allAssignments }, { data: allAvailability }, { data: employees }] = await Promise.all([
    supabase.from("assignments").select("*").in("shift_instance_id", safeInstanceIds),
    supabase.from("availability").select("*").in("shift_instance_id", safeInstanceIds).eq("is_available", true),
    supabase.from("employees").select("id, full_name").eq("active", true),
  ]);

  const nameById = new Map((employees ?? []).map((e) => [e.id, e.full_name]));

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">השיבוץ שלי</h1>

      <div className="space-y-8">
        {periods.map((period) => {
          const periodInstances = (instances ?? []).filter((i) => i.schedule_period_id === period.id);
          const periodInstanceIds = new Set(periodInstances.map((i) => i.id));

          const myShiftIds = new Set(
            (allAssignments ?? [])
              .filter((a) => a.employee_id === user!.id && periodInstanceIds.has(a.shift_instance_id))
              .map((a) => a.shift_instance_id)
          );
          const myShifts = periodInstances.filter((i) => myShiftIds.has(i.id));

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
            <div key={period.id}>
              <h2 className="mb-1 text-lg font-semibold">
                <DateText date={period.start_date} /> עד <DateText date={period.end_date} />
              </h2>
              {myShifts.length === 0 ? (
                <p className="mt-2 text-text-muted">לא שובצת למשמרות במחזור הזה.</p>
              ) : (
                <MyScheduleClient shifts={shiftsWithExtras} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
