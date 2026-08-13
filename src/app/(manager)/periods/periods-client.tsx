"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PERIOD_STATUS_LABELS } from "@/lib/constants";
import { DateText } from "@/components/date-text";
import type { SchedulePeriod } from "@/types/database";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-border-soft text-text-muted",
  collecting: "bg-brand-soft text-brand",
  generated: "bg-amber-bg text-amber",
  published: "bg-success-bg text-success",
};

function nextSunday(): string {
  const d = new Date();
  const diff = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function PeriodsClient({
  initialPeriods,
}: {
  initialPeriods: SchedulePeriod[];
}) {
  const router = useRouter();
  const [periods, setPeriods] = useState(initialPeriods);
  const [startDate, setStartDate] = useState(nextSunday());
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);

    const res = await fetch("/api/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: startDate }),
    });
    const body = await res.json();
    setCreating(false);

    if (!res.ok) {
      setError(body.error ?? "שגיאה");
      return;
    }
    if (body.calendarMessage) alert(body.calendarMessage);
    router.push(`/periods/${body.id}`);
  }

  return (
    <div>
      <form
        onSubmit={handleCreate}
        className="mb-6 flex flex-wrap items-end gap-3 rounded border border-border bg-surface p-4"
      >
        <div>
          <label className="mb-1 block text-sm font-semibold text-text">
            תאריך התחלה (יום ראשון)
          </label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-border px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {creating ? "פותח מחזור..." : "פתיחת מחזור חדש"}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>

      <div className="space-y-2">
        {periods.map((period) => (
          <Link
            key={period.id}
            href={`/periods/${period.id}`}
            className="flex items-center justify-between rounded border border-border bg-surface p-4 hover:border-brand"
          >
            <span className="font-medium">
              <DateText date={period.end_date} /> – <DateText date={period.start_date} />
            </span>
            <span
              className={`rounded px-3 py-1 text-xs font-semibold ${STATUS_COLORS[period.status]}`}
            >
              {PERIOD_STATUS_LABELS[period.status]}
            </span>
          </Link>
        ))}
        {periods.length === 0 && (
          <p className="text-center text-text-muted">אין עדיין מחזורי תכנון</p>
        )}
      </div>
    </div>
  );
}
