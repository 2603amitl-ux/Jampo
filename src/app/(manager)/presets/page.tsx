import { createClient } from "@/lib/supabase/server";
import PresetsClient from "./presets-client";

export default async function PresetsPage() {
  const supabase = await createClient();
  const { data: presets } = await supabase
    .from("shift_presets")
    .select("*")
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">פריסט משמרות</h1>
      <p className="mb-6 text-sm text-text-muted">
        התבנית הקבועה שממנה נבנה כל מחזור תכנון חדש — לפי יום בשבוע.
      </p>
      <PresetsClient initialPresets={presets ?? []} />
    </div>
  );
}
