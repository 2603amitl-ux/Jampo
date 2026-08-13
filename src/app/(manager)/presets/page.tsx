import { createClient } from "@/lib/supabase/server";
import CalendarSettings from "./calendar-settings";
import CertificationsManager from "./certifications-manager";
import PresetsClient from "./presets-client";

export default async function PresetsPage() {
  const supabase = await createClient();
  const { data: presets } = await supabase
    .from("shift_presets")
    .select("*")
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  const { data: certifications } = await supabase
    .from("certifications")
    .select("*")
    .order("name", { ascending: true });

  const { data: calendarSettings } = await supabase.from("calendar_settings").select("*").maybeSingle();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">הגדרות</h1>
      <p className="mb-6 text-sm text-text-muted">
        התבנית הקבועה שממנה נבנה כל מחזור תכנון חדש — לפי יום בשבוע.
      </p>
      <CalendarSettings settings={calendarSettings} />
      <CertificationsManager certifications={certifications ?? []} />
      <PresetsClient
        initialPresets={presets ?? []}
        allCertifications={(certifications ?? []).map((c) => c.name)}
      />
    </div>
  );
}
