import type {
  Availability,
  Certification,
  Employee,
  ShiftInstance,
  WeeklyShiftRequest,
} from "@/types/database";

export interface GeneratedAssignment {
  shift_instance_id: string;
  employee_id: string;
}

export interface Shortage {
  shift_instance_id: string;
  missing_headcount: number;
  missing_certifications: Certification[];
}

export interface ScheduleResult {
  assignments: GeneratedAssignment[];
  shortages: Shortage[];
}

function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// Shifts are processed most-constrained-first: whichever shift has the
// fewest interested, active candidates goes first, so a "flexible" shift
// with plenty of options doesn't get to a scarce candidate before a shift
// that genuinely needs them. Ties (including shifts with equal candidate
// counts) fall back to chronological order for a stable, predictable
// result. This is a static, one-time ordering computed from raw
// availability — it doesn't re-rank as assignments are made, which keeps
// the algorithm simple and fast. It reduces avoidable shortages but
// doesn't guarantee the mathematically optimal assignment; that would
// require modeling the whole period as a single matching/optimization
// problem instead of shift-by-shift (see conversation for why that's a
// bigger, costlier build for little practical gain at this scale).
export function generateSchedule(params: {
  shiftInstances: ShiftInstance[];
  availability: Availability[];
  weeklyRequests: WeeklyShiftRequest[];
  employees: Employee[];
}): ScheduleResult {
  const { availability, weeklyRequests, employees } = params;

  const activeEmployeeIds = new Set(employees.filter((e) => e.active).map((e) => e.id));
  const availableEmployeeIdsByShift = new Map<string, Set<string>>();
  for (const a of availability) {
    if (!a.is_available || !activeEmployeeIds.has(a.employee_id)) continue;
    if (!availableEmployeeIdsByShift.has(a.shift_instance_id)) {
      availableEmployeeIdsByShift.set(a.shift_instance_id, new Set());
    }
    availableEmployeeIdsByShift.get(a.shift_instance_id)!.add(a.employee_id);
  }
  const candidateCount = (shiftId: string) => availableEmployeeIdsByShift.get(shiftId)?.size ?? 0;

  const chronological = (a: ShiftInstance, b: ShiftInstance) =>
    a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date);

  const shiftInstances = [...params.shiftInstances].sort((a, b) => {
    const diff = candidateCount(a.id) - candidateCount(b.id);
    return diff !== 0 ? diff : chronological(a, b);
  });

  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const desiredCountByEmployee = new Map(weeklyRequests.map((r) => [r.employee_id, r.desired_shift_count]));

  const availableSet = new Set(
    availability.filter((a) => a.is_available).map((a) => `${a.employee_id}:${a.shift_instance_id}`)
  );

  const assignedCount = new Map<string, number>();
  // date -> employee_id -> shift time ranges already assigned that day
  const dailyAssignments = new Map<string, Map<string, { start: string; end: string }[]>>();

  const assignments: GeneratedAssignment[] = [];
  const shortages: Shortage[] = [];

  function hasOverlapOnDay(employeeId: string, date: string, start: string, end: string): boolean {
    const ranges = dailyAssignments.get(date)?.get(employeeId) ?? [];
    return ranges.some((r) => timeRangesOverlap(start, end, r.start, r.end));
  }

  function recordAssignment(employeeId: string, shift: ShiftInstance) {
    assignments.push({ shift_instance_id: shift.id, employee_id: employeeId });
    assignedCount.set(employeeId, (assignedCount.get(employeeId) ?? 0) + 1);

    if (!dailyAssignments.has(shift.date)) dailyAssignments.set(shift.date, new Map());
    const dayMap = dailyAssignments.get(shift.date)!;
    if (!dayMap.has(employeeId)) dayMap.set(employeeId, []);
    dayMap.get(employeeId)!.push({ start: shift.start_time, end: shift.end_time });
  }

  for (const shift of shiftInstances) {
    const assignedToThisShift = new Set<string>();

    function buildCandidatePool(): Employee[] {
      return employees.filter((emp) => {
        if (!emp.active) return false;
        if (assignedToThisShift.has(emp.id)) return false;
        if (!availableSet.has(`${emp.id}:${shift.id}`)) return false;
        const desired = desiredCountByEmployee.get(emp.id) ?? 0;
        if ((assignedCount.get(emp.id) ?? 0) >= desired) return false;
        if (hasOverlapOnDay(emp.id, shift.date, shift.start_time, shift.end_time)) return false;
        return true;
      });
    }

    function byPriorityDesc(a: Employee, b: Employee) {
      return b.priority - a.priority;
    }

    // 1. Cover every required certification first.
    for (const cert of shift.required_certifications) {
      const alreadyCovered = Array.from(assignedToThisShift).some((id) =>
        employeeById.get(id)?.certifications.includes(cert)
      );
      if (alreadyCovered) continue;

      const candidates = buildCandidatePool()
        .filter((emp) => emp.certifications.includes(cert))
        .sort(byPriorityDesc);

      if (candidates.length > 0) {
        const chosen = candidates[0];
        assignedToThisShift.add(chosen.id);
        recordAssignment(chosen.id, shift);
      }
    }

    // 2. Fill remaining headcount by priority.
    while (assignedToThisShift.size < shift.required_headcount) {
      const candidates = buildCandidatePool().sort(byPriorityDesc);
      if (candidates.length === 0) break;
      const chosen = candidates[0];
      assignedToThisShift.add(chosen.id);
      recordAssignment(chosen.id, shift);
    }

    // 3. Report any shortage.
    const missingHeadcount = Math.max(0, shift.required_headcount - assignedToThisShift.size);
    const missingCertifications = shift.required_certifications.filter(
      (cert) =>
        !Array.from(assignedToThisShift).some((id) =>
          employeeById.get(id)?.certifications.includes(cert)
        )
    );
    if (missingHeadcount > 0 || missingCertifications.length > 0) {
      shortages.push({
        shift_instance_id: shift.id,
        missing_headcount: missingHeadcount,
        missing_certifications: missingCertifications,
      });
    }
  }

  return { assignments, shortages };
}
