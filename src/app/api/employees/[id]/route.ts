import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/require-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_CERTIFICATIONS } from "@/lib/constants";
import { isUuid } from "@/lib/uuid";
import type { Certification } from "@/types/database";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const manager = await requireManager();
  if (!manager) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "מזהה עובד לא תקין" }, { status: 400 });
  }

  const body = await request.json();
  const admin = createAdminClient();

  const update: Record<string, unknown> = {};
  if (typeof body.full_name === "string") update.full_name = body.full_name.trim();
  if (typeof body.email === "string") update.email = body.email.trim() || null;
  if (typeof body.priority === "number") update.priority = body.priority;
  if (typeof body.active === "boolean") update.active = body.active;
  if (Array.isArray(body.certifications)) {
    update.certifications = (body.certifications as string[]).filter((c) =>
      ALL_CERTIFICATIONS.includes(c as Certification)
    );
  }

  if (Object.keys(update).length > 0) {
    const { error } = await admin.from("employees").update(update).eq("id", id);
    if (error) {
      return NextResponse.json({ error: "שגיאה בעדכון פרטי העובד" }, { status: 400 });
    }
  }

  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: "סיסמה חייבת להכיל לפחות 6 תווים" }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(id, {
      password: body.password,
    });
    if (error) {
      return NextResponse.json({ error: "שגיאה באיפוס הסיסמה" }, { status: 400 });
    }
  }

  // "active" only flagged the employees row — the Supabase Auth user could
  // still sign in regardless. Ban/unban the login itself to match.
  if (typeof body.active === "boolean") {
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: body.active ? "none" : "876000h",
    });
    if (error) {
      return NextResponse.json({ error: "שגיאה בעדכון גישת ההתחברות" }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
