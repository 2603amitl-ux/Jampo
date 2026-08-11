import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/require-manager";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/auth/username";
import { ALL_CERTIFICATIONS } from "@/lib/constants";
import type { Certification } from "@/types/database";

export async function POST(request: Request) {
  const manager = await requireManager();
  if (!manager) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json();
  const full_name = String(body.full_name ?? "").trim();
  const username = String(body.username ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const email = String(body.email ?? "").trim() || null;
  const priority = Number(body.priority ?? 0);
  const certifications: Certification[] = Array.isArray(body.certifications)
    ? body.certifications.filter((c: string) =>
        ALL_CERTIFICATIONS.includes(c as Certification)
      )
    : [];

  if (!full_name || !username || password.length < 6) {
    return NextResponse.json(
      { error: "שם מלא, שם משתמש וסיסמה (לפחות 6 תווים) הם שדות חובה" },
      { status: 400 }
    );
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return NextResponse.json(
      { error: "שם משתמש יכול להכיל רק אותיות/ספרות באנגלית, נקודה, מקף וקו תחתון" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    app_metadata: { role: "employee" },
  });

  if (createError || !created.user) {
    const message = createError?.message.includes("already been registered")
      ? "שם המשתמש כבר תפוס"
      : "שגיאה ביצירת המשתמש";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { error: insertError } = await admin.from("employees").insert({
    id: created.user.id,
    full_name,
    username,
    email,
    role: "employee",
    certifications,
    priority,
    active: true,
  });

  if (insertError) {
    // Roll back the auth user so we don't leave an orphaned login.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "שגיאה בשמירת פרטי העובד" }, { status: 400 });
  }

  return NextResponse.json({ id: created.user.id }, { status: 201 });
}
