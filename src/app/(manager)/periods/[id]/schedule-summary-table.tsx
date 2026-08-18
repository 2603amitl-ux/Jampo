import { DAY_NAMES, isTrained } from "@/lib/constants";
import type { Assignment, Availability, Employee, ShiftInstance, WeeklyShiftRequest } from "@/types/database";

export default function ScheduleSummaryTable({
  employees,
  instances,
  availability,
  weeklyRequests,
  assignments,
  selectedEmployeeId,
  onSelectEmployee,
}: {
  employees: Employee[];
  instances: ShiftInstance[];
  availability: Availability[];
  weeklyRequests: WeeklyShiftRequest[];
  assignments: Assignment[];
  selectedEmployeeId?: string | null;
  onSelectEmployee?: (employeeId: string) => void;
}) {
  const instanceById = new Map(instances.map((i) => [i.id, i]));

  const rows = employees
    .filter((e) => e.active)
    .map((employee) => {
      const wantedIds = availability
        .filter((a) => a.employee_id === employee.id && a.is_available)
        .map((a) => a.shift_instance_id);
      const assignedIds = new Set(
        assignments.filter((a) => a.employee_id === employee.id).map((a) => a.shift_instance_id)
      );
      const desired =
        weeklyRequests.find((r) => r.employee_id === employee.id)?.desired_shift_count ?? null;

      const missed = wantedIds
        .filter((id) => !assignedIds.has(id))
        .map((id) => instanceById.get(id))
        .filter((i): i is ShiftInstance => Boolean(i))
        .sort((a, b) =>
          a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date)
        );

      return {
        employee,
        submitted: wantedIds.length,
        desired,
        received: assignedIds.size,
        missed,
        underServed: desired !== null && assignedIds.size < desired,
      };
    })
    .sort((a, b) => b.employee.priority - a.employee.priority);

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-lg font-bold">סיכום לפי עובד</h2>
      <p className="mb-2 text-xs text-text-muted">לחצ/י על שם עובד/ת כדי להבליט את המשמרות שלו/ה בלוח למעלה.</p>
      <div className="overflow-x-auto rounded border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-right text-text-muted">
              <th className="px-4 py-3 text-[13px] font-semibold">עובד/ת</th>
              <th className="px-4 py-3 text-[13px] font-semibold">הגיש/ה</th>
              <th className="px-4 py-3 text-[13px] font-semibold">ביקש/ה</th>
              <th className="px-4 py-3 text-[13px] font-semibold">קיבל/ה</th>
              <th className="px-4 py-3 text-[13px] font-semibold">הערות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ employee, submitted, desired, received, missed, underServed }) => {
              const isSelected = selectedEmployeeId === employee.id;
              return (
              <tr
                key={employee.id}
                onClick={() => onSelectEmployee?.(employee.id)}
                className={`cursor-pointer border-b border-border-soft last:border-0 ${
                  isSelected ? "bg-brand-soft" : underServed ? "bg-amber-bg" : ""
                }`}
              >
                <td className="px-4 py-3.5">
                  {employee.full_name}
                  {!isTrained(employee) && (
                    <span className="mr-2 text-xs text-text-muted">(בהכשרה)</span>
                  )}
                  {underServed && (
                    <span className="mr-2 rounded-full bg-amber px-2 py-0.5 text-xs font-semibold text-white">
                      כדאי לפנות אליו/ה
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 tabular-nums">{submitted}</td>
                <td className="px-4 py-3.5 tabular-nums">{desired ?? "לא הגיש/ה"}</td>
                <td className="px-4 py-3.5 tabular-nums">{received}</td>
                <td className="px-4 py-3.5 text-text-muted">
                  {missed.length === 0
                    ? "—"
                    : missed
                        .map((i) => `${DAY_NAMES[new Date(`${i.date}T00:00:00Z`).getUTCDay()]} ${i.shift_name}`)
                        .join(", ")}
                </td>
              </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  אין עובדים פעילים
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
