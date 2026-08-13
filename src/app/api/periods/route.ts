import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateShiftInstances, periodEndDate } from "@/lib/scheduling/generate-instances";
import { syncCalendarEvents } from "@/lib/calendar-sync";
import type { GeneratedShiftInstance } from "@/lib/scheduling/generate-instances";

// Runs with the caller's own session (RLS-protected), not the admin client —
// creating a period and generating its shifts only needs the manager
// privileges the caller already has as a regular authenticated user.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await request.json();
  const startDate = String(body.start_date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "תאריך התחלה לא תקין" }, { status: 400 });
  }

  const { data: presets, error: presetsError } = await supabase
    .from("shift_presets")
    .select("*");
  if (presetsError) {
    return NextResponse.json({ error: "שגיאה בקריאת הפריסט" }, { status: 400 });
  }
  if (!presets || presets.length === 0) {
    return NextResponse.json(
      { error: "אין עדיין משמרות בפריסט — יש להגדיר אותו קודם" },
      { status: 400 }
    );
  }

  const { data: period, error: periodError } = await supabase
    .from("schedule_periods")
    .insert({ start_date: startDate, end_date: periodEndDate(startDate), status: "draft" })
    .select()
    .single();
  if (periodError || !period) {
    return NextResponse.json({ error: "שגיאה ביצירת המחזור" }, { status: 400 });
  }

  const presetInstances = generateShiftInstances(presets, period.id, startDate);

  const { data: settings } = await supabase.from("calendar_settings").select("*").maybeSingle();

  let calendarInstances: GeneratedShiftInstance[] = [];
  let calendarMessage: string | null = null;

  if (!settings?.ical_url) {
    calendarMessage = 'טרם הוגדר יומן Google לייבוא אוטומטי — אפשר להגדיר בעמוד "פריסט משמרות".';
  } else {
    const result = await syncCalendarEvents(settings.ical_url, period.id, startDate, period.end_date);
    calendarInstances = result.instances;
    if (result.fetchError) {
      calendarMessage = `לא ניתן היה לייבא אירועים מהיומן: ${result.fetchError}. אפשר להוסיף אותם ידנית.`;
    } else if (result.importedCount > 0) {
      calendarMessage =
        `${result.importedCount} אירועים יובאו מהיומן` +
        (result.defaultedAllDayCount > 0
          ? ` (${result.defaultedAllDayCount} מהם ללא שעה מוגדרת — נקבעו כ-09:00–17:00, כדאי לבדוק).`
          : ".");
    }
  }

  const { error: instancesError } = await supabase
    .from("shift_instances")
    .insert([...presetInstances, ...calendarInstances]);
  if (instancesError) {
    await supabase.from("schedule_periods").delete().eq("id", period.id);
    return NextResponse.json({ error: "שגיאה ביצירת המשמרות" }, { status: 400 });
  }

  return NextResponse.json({ id: period.id, calendarMessage }, { status: 201 });
}
