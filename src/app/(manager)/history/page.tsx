import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DateText } from "@/components/date-text";

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: periods } = await supabase
    .from("schedule_periods")
    .select("*")
    .eq("status", "published")
    .order("start_date", { ascending: false });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">היסטוריה</h1>
      <p className="mb-6 text-sm text-text-muted">מחזורים שפורסמו בעבר (לצפייה בלבד).</p>

      <div className="space-y-2">
        {(periods ?? []).map((period) => (
          <Link
            key={period.id}
            href={`/periods/${period.id}`}
            className="flex items-center justify-between rounded border border-border bg-surface p-4 hover:border-brand"
          >
            <span className="font-medium">
              <DateText date={period.end_date} /> – <DateText date={period.start_date} />
            </span>
            <span className="rounded bg-success-bg px-3 py-1 text-xs font-semibold text-success">פורסם</span>
          </Link>
        ))}
        {(periods ?? []).length === 0 && (
          <p className="text-center text-text-muted">אין עדיין מחזורים שפורסמו</p>
        )}
      </div>
    </div>
  );
}
