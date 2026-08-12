"use client";

import { useMemo, useState } from "react";
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
  const initialWanted = Object.fromEntries(
    initialAvailability.filter((a) => a.is_available).map((a) => [a.shift_instance_id, true])
  );

  // "wanted"/"desiredCount" are the live editing state; "saved*" mirror
  // whatever is currently persisted. Nothing hits the database until the
  // submit button is clicked — that's what lets us tell "has unsaved
  // changes" apart from "matches the database" and enable/disable the
  // button accordingly, instead of saving on every toggle/blur.
  const [wanted, setWanted] = useState<Record<string, boolean>>(initialWanted);
  const [savedWanted, setSavedWanted] = useState<Record<string, boolean>>(initialWanted);
  const [desiredCount, setDesiredCount] = useState(initialDesiredCount ?? 0);
  const [savedDesiredCount, setSavedDesiredCount] = useState(initialDesiredCount ?? 0);

  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    if (desiredCount !== savedDesiredCount) return true;
    const ids = new Set([...Object.keys(wanted), ...Object.keys(savedWanted)]);
    for (const id of ids) {
      if ((wanted[id] === true) !== (savedWanted[id] === true)) return true;
    }
    return false;
  }, [wanted, savedWanted, desiredCount, savedDesiredCount]);

  function handleToggle(shiftInstanceId: string) {
    if (locked) return;
    setJustSubmitted(false);
    setWanted((prev) => {
      const next = { ...prev };
      if (next[shiftInstanceId]) delete next[shiftInstanceId];
      else next[shiftInstanceId] = true;
      return next;
    });
  }

  function handleDesiredCountChange(value: number) {
    if (locked) return;
    setJustSubmitted(false);
    setDesiredCount(value);
  }

  async function handleSubmit() {
    if (locked || !isDirty) return;
    setSubmitting(true);
    setSubmitError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const newlyWanted = Object.keys(wanted).filter((id) => wanted[id] && !savedWanted[id]);
    const newlyUnwanted = Object.keys(savedWanted).filter((id) => savedWanted[id] && !wanted[id]);

    if (newlyWanted.length > 0) {
      const { error } = await supabase.from("availability").upsert(
        newlyWanted.map((shift_instance_id) => ({
          employee_id: user!.id,
          shift_instance_id,
          is_available: true,
        })),
        { onConflict: "employee_id,shift_instance_id" }
      );
      if (error) {
        setSubmitting(false);
        setSubmitError("שגיאה בשמירת המשמרות. נסה/י שוב.");
        return;
      }
    }

    if (newlyUnwanted.length > 0) {
      const { error } = await supabase
        .from("availability")
        .delete()
        .eq("employee_id", user!.id)
        .in("shift_instance_id", newlyUnwanted);
      if (error) {
        setSubmitting(false);
        setSubmitError("שגיאה בשמירת המשמרות. נסה/י שוב.");
        return;
      }
    }

    if (desiredCount !== savedDesiredCount) {
      const { error } = await supabase.from("weekly_shift_requests").upsert(
        {
          employee_id: user!.id,
          schedule_period_id: period.id,
          desired_shift_count: desiredCount,
        },
        { onConflict: "employee_id,schedule_period_id" }
      );
      if (error) {
        setSubmitting(false);
        setSubmitError("שגיאה בשמירת מכסת המשמרות. נסה/י שוב.");
        return;
      }
    }

    setSubmitting(false);
    setJustSubmitted(true);
    setSavedWanted(wanted);
    setSavedDesiredCount(desiredCount);
  }

  const dates = Array.from(new Set(instances.map((i) => i.date))).sort();

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">
        הגשת זמינות — <DateText date={period.start_date} /> עד <DateText date={period.end_date} />
      </h1>
      <p className="mb-4 text-sm text-text-muted">
        סמנ/י את המשמרות שתרצה/י לעבוד, ולחצ/י על &quot;הגש&quot; בסוף כדי לשמור.
      </p>

      {locked && (
        <p className="mb-4 rounded bg-amber-bg px-3 py-2 text-sm text-amber">
          ההגשה נעולה — המנהל כבר בנה את השיבוץ למחזור הזה, לא ניתן לערוך יותר.
        </p>
      )}

      <div className="mb-6 rounded border border-border bg-surface p-4">
        <label className="mb-1 block text-sm font-semibold text-text">
          כמה משמרות תרצה/י לעבוד השבוע?
        </label>
        <input
          type="number"
          min={0}
          disabled={locked}
          value={desiredCount}
          onChange={(e) => handleDesiredCountChange(Number(e.target.value))}
          className="w-24 rounded border border-border px-3 py-2 tabular-nums disabled:bg-border-soft"
        />
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
                        disabled={locked}
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

      {!locked && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={!isDirty || submitting}
            className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "שולח..." : "הגש"}
          </button>
          <span className="text-xs text-text-muted">
            {submitError
              ? submitError
              : isDirty
                ? "יש שינויים שעדיין לא הוגשו"
                : justSubmitted
                  ? "ההגשה נשמרה"
                  : ""}
          </span>
        </div>
      )}
    </div>
  );
}
