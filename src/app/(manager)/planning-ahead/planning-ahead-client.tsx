"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DateText } from "@/components/date-text";
import { computeHighPriorityGaps, computeOverlapRanges } from "@/lib/planning-insights";
import type { Employee, EmployeeUnavailability } from "@/types/database";

export default function PlanningAheadClient({
  initialEntries,
  employees,
}: {
  initialEntries: EmployeeUnavailability[];
  employees: Employee[];
}) {
  const supabase = createClient();
  const [entries, setEntries] = useState(initialEntries);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const activeCount = useMemo(() => employees.filter((e) => e.active).length, [employees]);
  const threshold = Math.max(3, Math.ceil(activeCount * 0.3));

  const overlapRanges = useMemo(
    () => computeOverlapRanges(entries, employeeById, threshold),
    [entries, employeeById, threshold]
  );
  const highPriorityGaps = useMemo(() => computeHighPriorityGaps(entries, employees), [entries, employees]);

  async function handleDelete(id: string) {
    const { error } = await supabase.from("employee_unavailability").delete().eq("id", id);
    if (error) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">תכנון קדימה</h1>
      <p className="mb-4 text-sm text-text-muted">
        תאריכים עתידיים שעובדים דיווחו שהם לא זמינים בהם (חופשה, רפואי וכו&apos;).
      </p>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-border bg-surface p-4">
          <h2 className="mb-2 font-bold">ריבוי היעדרויות</h2>
          {overlapRanges.length === 0 ? (
            <p className="text-sm text-text-muted">אין תאריכים עם היעדרות חריגה כרגע.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {overlapRanges.map((range) => (
                <li key={`${range.start}-${range.end}`} className="rounded bg-amber-bg p-2">
                  <div className="font-semibold text-amber">
                    <DateText date={range.start} /> עד <DateText date={range.end} /> — {range.count} עובדים לא
                    זמינים
                  </div>
                  <div className="text-text-muted">{range.employeeNames.join(", ")}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded border border-border bg-surface p-4">
          <h2 className="mb-2 font-bold">עובדים בעדיפות גבוהה</h2>
          {highPriorityGaps.length === 0 ? (
            <p className="text-sm text-text-muted">כל העובדים בעדיפות גבוהה זמינים.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {highPriorityGaps.map(({ employee, entry }) => (
                <li key={entry.id} className="rounded bg-amber-bg p-2">
                  <div className="font-semibold text-amber">
                    {employee.full_name} (עדיפות {employee.priority})
                  </div>
                  <div className="text-text-muted">
                    <DateText date={entry.start_date} /> עד <DateText date={entry.end_date} /> · {entry.reason}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h2 className="mb-2 text-lg font-bold">כל הדיווחים</h2>
      {entries.length === 0 ? (
        <p className="text-text-muted">אין דיווחים עתידיים כרגע.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-text-muted">
                <th className="px-4 py-3 text-[13px] font-semibold">עובד/ת</th>
                <th className="px-4 py-3 text-[13px] font-semibold">מתאריך</th>
                <th className="px-4 py-3 text-[13px] font-semibold">עד תאריך</th>
                <th className="px-4 py-3 text-[13px] font-semibold">סיבה</th>
                <th className="px-4 py-3 text-[13px] font-semibold">הערה</th>
                <th className="px-4 py-3 text-[13px] font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border-soft last:border-0">
                  <td className="px-4 py-3">{employeeById.get(entry.employee_id)?.full_name ?? "?"}</td>
                  <td className="px-4 py-3">
                    <DateText date={entry.start_date} />
                  </td>
                  <td className="px-4 py-3">
                    <DateText date={entry.end_date} />
                  </td>
                  <td className="px-4 py-3">{entry.reason}</td>
                  <td className="px-4 py-3 text-text-muted">{entry.note ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(entry.id)} className="text-danger">
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
