import { createClient } from "@/lib/supabase/server";
import PeriodsClient from "./periods-client";

export default async function PeriodsPage() {
  const supabase = await createClient();
  const { data: periods } = await supabase
    .from("schedule_periods")
    .select("*")
    .order("start_date", { ascending: false });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">מחזורי תכנון</h1>
      <p className="mb-6 text-sm text-text-muted">
        כל מחזור מכסה שבוע. פתיחת מחזור חדש יוצרת אוטומטית את כל המשמרות מהפריסט.
      </p>
      <PeriodsClient initialPeriods={periods ?? []} />
    </div>
  );
}
