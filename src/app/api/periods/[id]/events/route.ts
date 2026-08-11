import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { ALL_CERTIFICATIONS } from "@/lib/constants";
import type { Certification } from "@/types/database";

// An "event" is a fully custom shift the manager adds by hand — its own
// date/hours/headcount/certifications, independent of the preset. It's
// just a shift_instance with is_event=true so the rest of the app (the
// scheduling algorithm, availability screen, etc.) treats it exactly like
// any other shift.
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

  const body = await request.json();
  const date = String(body.date ?? "");
  const title = String(body.title ?? "").trim();
  const startTime = String(body.start_time ?? "");
  const endTime = String(body.end_time ?? "");
  const headcount = Number(body.required_headcount ?? 0);
  const certifications: Certification[] = Array.isArray(body.required_certifications)
    ? body.required_certifications.filter((c: string) =>
        ALL_CERTIFICATIONS.includes(c as Certification)
      )
    : [];
  const note = typeof body.note === "string" ? body.note.trim() || null : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title || !startTime || !endTime) {
    return NextResponse.json(
      { error: "יש למלא תאריך, כותרת ושעות התחלה/סיום" },
      { status: 400 }
    );
  }
  if (endTime <= startTime) {
    return NextResponse.json({ error: "שעת סיום חייבת להיות אחרי שעת התחלה" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shift_instances")
    .insert({
      schedule_period_id: periodId,
      date,
      shift_name: title,
      start_time: startTime,
      end_time: endTime,
      required_headcount: headcount,
      required_certifications: certifications,
      is_event: true,
      event_note: note,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "שגיאה בשמירת האירוע" }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
