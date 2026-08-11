import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/require-manager";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { getResendClient, getFromAddress } from "@/lib/email/resend";
import { scheduleAssignmentEmail } from "@/lib/email/templates";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const manager = await requireManager();
  if (!manager) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { id: periodId } = await params;
  if (!isUuid(periodId)) {
    return NextResponse.json({ error: "מזהה מחזור לא תקין" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: period } = await supabase
    .from("schedule_periods")
    .select("*")
    .eq("id", periodId)
    .single();
  if (!period) {
    return NextResponse.json({ error: "מחזור לא נמצא" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("schedule_periods")
    .update({ status: "published" })
    .eq("id", periodId);
  if (updateError) {
    return NextResponse.json({ error: "שגיאה בפרסום המחזור" }, { status: 400 });
  }

  const resend = getResendClient();
  if (!resend) {
    return NextResponse.json({
      published: true,
      error: "שירות המייל עוד לא הוגדר (RESEND_API_KEY חסר) — השיבוץ פורסם, אבל לא נשלחו מיילים",
    });
  }

  const { data: shiftInstances } = await supabase
    .from("shift_instances")
    .select("*")
    .eq("schedule_period_id", periodId);
  const instanceById = new Map((shiftInstances ?? []).map((s) => [s.id, s]));
  const instanceIds = Array.from(instanceById.keys());

  const { data: assignments } = await supabase
    .from("assignments")
    .select("*")
    .in("shift_instance_id", instanceIds.length > 0 ? instanceIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: employees } = await supabase.from("employees").select("*").eq("role", "employee");
  const employeeById = new Map((employees ?? []).map((e) => [e.id, e]));

  const shiftsByEmployee = new Map<string, { date: string; shiftName: string; startTime: string; endTime: string }[]>();
  for (const assignment of assignments ?? []) {
    const instance = instanceById.get(assignment.shift_instance_id);
    if (!instance) continue;
    if (!shiftsByEmployee.has(assignment.employee_id)) shiftsByEmployee.set(assignment.employee_id, []);
    shiftsByEmployee.get(assignment.employee_id)!.push({
      date: instance.date,
      shiftName: instance.shift_name,
      startTime: instance.start_time,
      endTime: instance.end_time,
    });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  let sent = 0;
  let skipped = 0;

  for (const [employeeId, shifts] of shiftsByEmployee) {
    const employee = employeeById.get(employeeId);
    if (!employee?.email) {
      skipped++;
      continue;
    }
    shifts.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));

    const { subject, html } = scheduleAssignmentEmail({
      fullName: employee.full_name,
      periodStart: period.start_date,
      periodEnd: period.end_date,
      shifts,
      siteUrl,
    });
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: employee.email,
      subject,
      html,
    });
    if (!error) sent++;
  }

  return NextResponse.json({ published: true, sent, skipped });
}
