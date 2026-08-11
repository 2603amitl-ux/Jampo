"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DAY_NAMES } from "@/lib/constants";
import { DateText } from "@/components/date-text";
import type { Availability, SchedulePeriod, ShiftInstance } from "@/types/database";

export default function AvailabilityClient({
  period,
  instances,
  initialAvailability,
  initialDesiredCount,
}: {
  period: SchedulePeriod;
  instances: ShiftInstance[];
  initialAvailability: Availability[];
  initialDesiredCount: number | null;
}) {
  const supabase = createClient();
  const locked = period.status !== "collecting";

  // Only "wants this shift" (true) is ever stored — the algorithm treats
  // "no row" and "explicitly not available" identically, so there's no
  // real distinction to capture; a plain want/don't-want toggle is enough.
  const [wanted, setWanted] = useState<Record<string, boolean>>(
    Object.fromEntries(initialAvailability.filter((a) => a.is_available).map((a) => [a.shift_instance_id, true]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const [desiredCount, setDesiredCount] = useState(initialDesiredCount ?? 0);
  const [countSaved, setCountSaved] = useState(true);
  const [savingCount, setSavingCount] = useState(false);

  async function handleToggle(shiftInstanceId: string) {
    if (locked) return;
    setSavingId(shiftInstanceId);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const currentlyWanted = wanted[shiftInstanceId] === true;

    const { error } = currentlyWanted
      ? await supabase
          .from("availability")
          .delete()
          .eq("employee_id", user!.id)
          .eq("shift_instance_id", shiftInstanceId)
      : await supabase.from("availability").upsert(
          {
            employee_id: user!.id,
            shift_instance_id: shiftInstanceId,
            is_available: true,
          },
          { onConflict: "employee_id,shift_instance_id" }
        );

    setSavingId(null);
    if (!error) {
      setWanted((prev) => {
        const next = { ...prev };
        if (currentlyWanted) delete next[shiftInstanceId];
        else next[shiftInstanceId] = true;
        return next;
      });
    }
  }

  async function handleSaveCount() {
    if (locked) return;
    setSavingCount(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("weekly_shift_requests").upsert(
      {
        employee_id: user!.id,
        schedule_period_id: period.id,
        desired_shift_count: desiredCount,
      },
      { onConflict: "employee_id,schedule_period_id" }
    );
    setSavingCount(false);
    if (!error) setCountSaved(true);
  }

  const dates = Array.from(new Set(instances.map((i) => i.date))).sort();

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">
        הגשת זמינות — <DateText date={period.start_date} /> עד <DateText date={period.end_date} />
      </h1>
      <p className="mb-4 text-sm text-text-muted">סמנ/י את המשמרות שתרצה/י לעבוד.</p>

      {locked && (
        <p className="mb-4 rounded bg-amber-bg px-3 py-2 text-sm text-amber">
          ההגשה נעולה — המנהל כבר בנה את השיבוץ למחזור הזה, לא ניתן לערוך יותר.
        </p>
      )}

      <div className="mb-6 rounded border border-border bg-surface p-4">
        <label className="mb-1 block text-sm font-semibold text-text">
          כמה משמרות תרצה/י לעבוד השבוע?
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            disabled={locked}
            value={desiredCount}
            onChange={(e) => {
              setDesiredCount(Number(e.target.value));
              setCountSaved(false);
            }}
            onBlur={handleSaveCount}
            className="w-24 rounded border border-border px-3 py-2 tabular-nums disabled:bg-border-soft"
          />
          {!locked && (
            <span className="text-xs text-text-muted">
              {savingCount ? "שומר..." : countSaved ? "נשמר" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {dates.map((date) => {
            const dayName = DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];
            const dayInstances = instances
              .filter((i) => i.date === date)
              .sort((a, b) => a.start_time.localeCompare(b.start_time));

            return (
              <div key={date} className="rounded border border-border bg-surface p-2">
                <div className="mb-2 text-center">
                  <div className="text-sm font-semibold">{dayName}</div>
                  <div className="text-xs text-text-muted">
                    <DateText date={date} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  {dayInstances.map((instance) => {
                    const isWanted = wanted[instance.id] === true;
                    return (
                      <button
                        key={instance.id}
                        type="button"
                        disabled={locked || savingId === instance.id}
                        onClick={() => handleToggle(instance.id)}
                        className={`w-full rounded border px-2 py-1.5 text-right text-xs disabled:opacity-50 ${
                          isWanted
                            ? "border-brand bg-brand-soft"
                            : "border-border-soft bg-bg hover:border-brand"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{instance.shift_name}</span>
                          {isWanted && <span className="text-brand">✓</span>}
                        </div>
                        <div className="text-text-muted">
                          <bdi dir="ltr">
                            {instance.start_time.slice(0, 5)}–{instance.end_time.slice(0, 5)}
                          </bdi>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
