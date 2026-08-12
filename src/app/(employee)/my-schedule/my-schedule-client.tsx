"use client";

import { useState } from "react";
import { DAY_NAMES } from "@/lib/constants";
import { DateText } from "@/components/date-text";
import type { ShiftInstance } from "@/types/database";

interface ShiftWithExtras {
  shift: ShiftInstance;
  coworkers: string[];
  swapCandidates: string[];
}

export default function MyScheduleClient({ shifts }: { shifts: ShiftWithExtras[] }) {
  const [swapPopupFor, setSwapPopupFor] = useState<string | null>(null);
  const activeSwap = shifts.find((s) => s.shift.id === swapPopupFor);

  return (
    <div className="mt-4 space-y-2">
      {shifts.map(({ shift, coworkers, swapCandidates }) => (
        <div key={shift.id} className="rounded border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">
                יום {DAY_NAMES[new Date(`${shift.date}T00:00:00Z`).getUTCDay()]} · <DateText date={shift.date} />
              </div>
              <div className="text-sm text-text-muted">{shift.shift_name}</div>
            </div>
            <div className="text-sm text-text-muted">
              <bdi dir="ltr">
                {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
              </bdi>
            </div>
          </div>

          <div className="mt-2 text-sm text-text-muted">
            {coworkers.length === 0
              ? "אין עוד עובדים משובצים למשמרת הזו"
              : `עובדים במשמרת: ${coworkers.join(", ")}`}
          </div>

          <button
            onClick={() => setSwapPopupFor(shift.id)}
            className="mt-2 text-sm font-semibold text-brand hover:underline"
          >
            אפשרות להחלפה
          </button>
        </div>
      ))}

      {activeSwap && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSwapPopupFor(null)}
        >
          <div
            className="w-full max-w-sm rounded border border-border bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 font-bold">{activeSwap.shift.shift_name}</h3>
            <p className="mb-2 text-xs text-text-muted">
              מי סימנ/ה זמינות למשמרת הזו ובסוף לא קיבל/ה אותה — אפשר לפנות אליהם בנוגע להחלפה.
            </p>
            {activeSwap.swapCandidates.length === 0 ? (
              <p className="text-sm text-text-muted">אף אחד לא ביקש את המשמרת הזו ולא קיבל אותה.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {activeSwap.swapCandidates.map((name) => (
                  <li key={name} className="rounded bg-bg px-2 py-1">
                    {name}
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setSwapPopupFor(null)}
              className="mt-3 rounded px-2 py-1 text-sm text-text-muted hover:text-text"
            >
              סגירה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
