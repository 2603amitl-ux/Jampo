import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/require-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResendClient, getFromAddress } from "@/lib/email/resend";
import { availabilityReminderEmail } from "@/lib/email/templates";
import { isUuid } from "@/lib/uuid";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const manager = await requireManager();
  if (!manager) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { id: periodId } = await params;
  if (!isUuid(periodId)) {
    return NextResponse.json({ error: "מזהה מחזור לא תקין" }, { status: 400 });
  }

  const resend = getResendClient();
  if (!resend) {
    return NextResponse.json(
      { error: "שירות המייל עוד לא הוגדר (RESEND_API_KEY חסר) — אפשר להמשיך בלעדיו בינתיים" },
      { status: 200 }
    );
  }

  const admin = createAdminClient();

  const { data: period } = await admin
    .from("schedule_periods")
    .select("*")
    .eq("id", periodId)
    .single();
  if (!period) {
    return NextResponse.json({ error: "מחזור לא נמצא" }, { status: 404 });
  }

  const { data: employees } = await admin
    .from("employees")
    .select("*")
    .eq("active", true)
    .eq("role", "employee");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const withEmail = (employees ?? []).filter((e) => e.email);

  let sent = 0;
  for (const employee of withEmail) {
    const { subject, html } = availabilityReminderEmail({
      fullName: employee.full_name,
      periodStart: period.start_date,
      periodEnd: period.end_date,
      siteUrl,
    });
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: employee.email!,
      subject,
      html,
    });
    if (!error) sent++;
  }

  const skipped = (employees ?? []).length - withEmail.length;
  return NextResponse.json({ sent, skipped });
}
