import type { Employee, EmployeeUnavailability } from "@/types/database";

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface OverlapRange {
  start: string;
  end: string;
  count: number;
  employeeNames: string[];
}

// Sweep-line over start/end+1 deltas — turns a pile of possibly-overlapping
// date ranges into a minimal set of constant-overlap-count ranges, without
// enumerating every individual day.
export function computeOverlapRanges(
  entries: EmployeeUnavailability[],
  employeeById: Map<string, Employee>,
  threshold: number
): OverlapRange[] {
  if (entries.length === 0) return [];

  const deltaByDate = new Map<string, number>();
  for (const e of entries) {
    deltaByDate.set(e.start_date, (deltaByDate.get(e.start_date) ?? 0) + 1);
    const dayAfterEnd = addDaysISO(e.end_date, 1);
    deltaByDate.set(dayAfterEnd, (deltaByDate.get(dayAfterEnd) ?? 0) - 1);
  }

  const sortedDates = [...deltaByDate.keys()].sort();
  const ranges: OverlapRange[] = [];
  let count = 0;

  for (let i = 0; i < sortedDates.length; i++) {
    count += deltaByDate.get(sortedDates[i])!;
    const start = sortedDates[i];
    const end = i + 1 < sortedDates.length ? addDaysISO(sortedDates[i + 1], -1) : start;
    if (count >= threshold) {
      const names = entries
        .filter((e) => e.start_date <= end && e.end_date >= start)
        .map((e) => employeeById.get(e.employee_id)?.full_name)
        .filter((n): n is string => Boolean(n));
      ranges.push({ start, end, count, employeeNames: [...new Set(names)] });
    }
  }

  return ranges;
}

export interface HighPriorityGap {
  employee: Employee;
  entry: EmployeeUnavailability;
}

// "High priority" is relative to the current team, not a fixed number —
// anyone above the average priority among active employees.
export function computeHighPriorityGaps(
  entries: EmployeeUnavailability[],
  employees: Employee[]
): HighPriorityGap[] {
  const activeEmployees = employees.filter((e) => e.active);
  if (activeEmployees.length === 0) return [];

  const avgPriority = activeEmployees.reduce((sum, e) => sum + e.priority, 0) / activeEmployees.length;
  const highPriorityIds = new Set(
    activeEmployees.filter((e) => e.priority > avgPriority).map((e) => e.id)
  );
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  return entries
    .filter((e) => highPriorityIds.has(e.employee_id))
    .map((e) => ({ employee: employeeById.get(e.employee_id)!, entry: e }))
    .sort((a, b) => a.entry.start_date.localeCompare(b.entry.start_date));
}
