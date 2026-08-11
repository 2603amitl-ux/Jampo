import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { generateSchedule } from "@/lib/scheduling/algorithm";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { id: periodId } = await params;
  if (!isUuid(periodId)) {
    return NextResponse.json({ error: "מזהה מחזור לא תקין" }, { status: 400 });
  }

  const { data: period } = await supabase
    .from("schedule_periods")
    .select("*")
    .eq("id", periodId)
    .single();
  if (!period) {
    return NextResponse.json({ error: "מחזור לא נמצא" }, { status: 404 });
  }

  const { data: shiftInstances } = await supabase
    .from("shift_instances")
    .select("*")
    .eq("schedule_period_id", periodId);
  const instanceIds = (shiftInstances ?? []).map((s) => s.id);

  const { data: employees } = await supabase.from("employees").select("*").eq("active", true);

  const { data: availability } = await supabase
    .from("availability")
    .select("*")
    .in("shift_instance_id", instanceIds.length > 0 ? instanceIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: weeklyRequests } = await supabase
    .from("weekly_shift_requests")
    .select("*")
    .eq("schedule_period_id", periodId);

  const { assignments, shortages } = generateSchedule({
    shiftInstances: shiftInstances ?? [],
    availability: availability ?? [],
    weeklyRequests: weeklyRequests ?? [],
    employees: employees ?? [],
  });

  if (instanceIds.length > 0) {
    await supabase.from("assignments").delete().in("shift_instance_id", instanceIds);
  }

  if (assignments.length > 0) {
    const { error: insertError } = await supabase.from("assignments").insert(
      assignments.map((a) => ({ ...a, assigned_by: "algorithm" as const }))
    );
    if (insertError) {
      return NextResponse.json({ error: "שגיאה בשמירת השיבוץ" }, { status: 400 });
    }
  }

  await supabase.from("schedule_periods").update({ status: "generated" }).eq("id", periodId);

  return NextResponse.json({ assignments, shortages });
}
