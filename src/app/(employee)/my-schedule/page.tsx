import { createClient } from "@/lib/supabase/server";
import { DAY_NAMES } from "@/lib/constants";
import { DateText } from "@/components/date-text";

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

  const { data: myAssignments } = await supabase
    .from("assignments")
    .select("shift_instance_id")
    .eq("employee_id", user!.id)
    .in("shift_instance_id", instanceIds.length > 0 ? instanceIds : ["00000000-0000-0000-0000-000000000000"]);

  const myShiftIds = new Set((myAssignments ?? []).map((a) => a.shift_instance_id));
  const myShifts = (instances ?? []).filter((i) => myShiftIds.has(i.id));

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">
        השיבוץ שלי — <DateText date={period.start_date} /> עד <DateText date={period.end_date} />
      </h1>

      {myShifts.length === 0 ? (
        <p className="mt-4 text-text-muted">לא שובצת למשמרות במחזור הזה.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {myShifts.map((shift) => (
            <div
              key={shift.id}
              className="flex items-center justify-between rounded border border-border bg-surface p-4"
            >
              <div>
                <div className="font-medium">
                  יום {DAY_NAMES[new Date(`${shift.date}T00:00:00Z`).getUTCDay()]} · <DateText date={shift.date} />
                </div>
                <div className="text-sm text-text-muted">{shift.shift_name}</div>
              </div>
              <div className="text-sm text-text-muted">
                <bdi dir="ltr">
                  {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
                </bdi>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
