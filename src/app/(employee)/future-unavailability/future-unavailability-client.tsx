"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UNAVAILABILITY_REASONS } from "@/lib/constants";
import { DateText } from "@/components/date-text";
import type { EmployeeUnavailability } from "@/types/database";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FutureUnavailabilityClient({
  initialEntries,
}: {
  initialEntries: EmployeeUnavailability[];
}) {
  const supabase = createClient();
  const [entries, setEntries] = useState(initialEntries);
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [reason, setReason] = useState(UNAVAILABILITY_REASONS[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (endDate < startDate) {
      setError("תאריך הסיום חייב להיות אחרי תאריך ההתחלה");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error: insertError } = await supabase
      .from("employee_unavailability")
      .insert({
        employee_id: user!.id,
        start_date: startDate,
        end_date: endDate,
        reason,
        note: note.trim() || null,
      })
      .select()
      .single();

    setSaving(false);
    if (insertError || !data) {
      setError("שגיאה בשמירה, נסה/י שוב");
      return;
    }
    setEntries((prev) => [...prev, data].sort((a, b) => a.start_date.localeCompare(b.start_date)));
    setNote("");
  }

  async function handleDelete(id: string) {
    const { error: deleteError } = await supabase.from("employee_unavailability").delete().eq("id", id);
    if (deleteError) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">תכנון קדימה</h1>
      <p className="mb-4 text-sm text-text-muted">
        דיווח על תאריכים בעתיד שבהם לא תוכל/י לעבוד (חופשה, מילואים, רפואי וכו&apos;). המנהל רואה את זה, זה לא
        קשור להגשת זמינות השבועית.
      </p>

      <form onSubmit={handleSubmit} className="mb-6 rounded border border-border bg-surface p-4">
        <div className="mb-2 flex flex-wrap gap-2">
          <label className="flex-1">
            <span className="mb-0.5 block text-sm text-text-muted">מתאריך</span>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full min-w-0 rounded border border-border px-2 py-1.5"
            />
          </label>
          <label className="flex-1">
            <span className="mb-0.5 block text-sm text-text-muted">עד תאריך</span>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full min-w-0 rounded border border-border px-2 py-1.5"
            />
          </label>
        </div>

        <label className="mb-2 block">
          <span className="mb-0.5 block text-sm text-text-muted">סיבה</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-border px-2 py-1.5"
          >
            {UNAVAILABILITY_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block">
          <span className="mb-0.5 block text-sm text-text-muted">הערה (אופציונלי)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded border border-border px-2 py-1.5"
          />
        </label>

        {error && <p className="mb-2 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {saving ? "שומר..." : "דיווח"}
        </button>
      </form>

      <h2 className="mb-2 text-lg font-bold">הדיווחים שלי</h2>
      {entries.length === 0 ? (
        <p className="text-text-muted">עדיין לא דיווחת על תאריכים.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded border border-border bg-surface p-3 text-sm"
            >
              <div>
                <div className="font-medium">
                  <DateText date={entry.start_date} /> עד <DateText date={entry.end_date} />
                </div>
                <div className="text-text-muted">
                  {entry.reason}
                  {entry.note && ` · ${entry.note}`}
                </div>
              </div>
              <button onClick={() => handleDelete(entry.id)} className="text-danger">
                ביטול
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
