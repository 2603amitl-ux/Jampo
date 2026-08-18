import type {
  Availability,
  Certification,
  Employee,
  ShiftInstance,
  WeeklyShiftRequest,
} from "@/types/database";
import { isTrained } from "@/lib/constants";

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

// An event is "nested" in a shift when its whole time range sits inside the
// shift's — not just overlapping at an edge. Only this clean-containment
// case is eligible for borrowing (see the reallocation pass below); a event
// that starts before or runs past the shift is left alone.
function isNestedInShift(event: ShiftInstance, shift: ShiftInstance): boolean {
  return (
    !shift.is_event &&
    shift.date === event.date &&
    shift.start_time <= event.start_time &&
    event.end_time <= shift.end_time
  );
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

  const employeeById = new Map(employees.map((e) => [e.id, e]));

  // Only trained (has the base certification) + active employees compete
  // for a shift's required headcount/certifications — an employee still
  // working toward that certification never fills a real slot (see the
  // bonus pass at the end, which adds them as supplementary help instead).
  const trainedActiveEmployeeIds = new Set(
    employees.filter((e) => e.active && isTrained(e)).map((e) => e.id)
  );
  const availableEmployeeIdsByShift = new Map<string, Set<string>>();
  for (const a of availability) {
    if (!a.is_available || !trainedActiveEmployeeIds.has(a.employee_id)) continue;
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

  const desiredCountByEmployee = new Map(weeklyRequests.map((r) => [r.employee_id, r.desired_shift_count]));

  const availableSet = new Set(
    availability.filter((a) => a.is_available).map((a) => `${a.employee_id}:${a.shift_instance_id}`)
  );

  const assignedCount = new Map<string, number>();
  // date -> employee_id -> shift time ranges already assigned that day
  const dailyAssignments = new Map<string, Map<string, { start: string; end: string }[]>>();
  // shift_instance_id -> ids of employees counted toward its required
  // headcount/certifications. Kept across passes 1-2 so shortages can be
  // computed once at the very end. Bonus (in-training) assignments in pass
  // 3 are deliberately NOT added here, so they never mask a real shortage.
  const assignedByShift = new Map<string, Set<string>>();

  const assignments: GeneratedAssignment[] = [];

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

  // Availability is checked against `availabilityShiftId` (the shift whose
  // sign-up list to draw from), while the overlap/day check runs against
  // the actual (date, start, end) being filled — for a plain shift these
  // are the same shift; for the reallocation pass below they differ (a
  // regular shift's sign-ups are borrowed to cover an event's time slot).
  // Only trained employees are ever eligible here — an in-training
  // employee never counts toward a real headcount/certification slot,
  // whether by direct sign-up or by borrowing.
  function eligibleCandidates(
    availabilityShiftId: string,
    excludeIds: Set<string>,
    date: string,
    start: string,
    end: string
  ): Employee[] {
    return employees.filter((emp) => {
      if (!emp.active) return false;
      if (!isTrained(emp)) return false;
      if (excludeIds.has(emp.id)) return false;
      if (!availableSet.has(`${emp.id}:${availabilityShiftId}`)) return false;
      const desired = desiredCountByEmployee.get(emp.id) ?? 0;
      if ((assignedCount.get(emp.id) ?? 0) >= desired) return false;
      if (hasOverlapOnDay(emp.id, date, start, end)) return false;
      return true;
    });
  }

  function byPriorityDesc(a: Employee, b: Employee) {
    return b.priority - a.priority;
  }
  function byPriorityAsc(a: Employee, b: Employee) {
    return a.priority - b.priority;
  }

  // Fills a shift/event's required certifications first, then remaining
  // headcount, pulling from whatever pool `getCandidates` returns (re-run
  // on every pick since assignedSet/assignedCount change as we go).
  function fillFrom(
    target: ShiftInstance,
    assignedSet: Set<string>,
    getCandidates: () => Employee[],
    priorityOrder: (a: Employee, b: Employee) => number
  ) {
    for (const cert of target.required_certifications) {
      const alreadyCovered = Array.from(assignedSet).some((id) =>
        employeeById.get(id)?.certifications.includes(cert)
      );
      if (alreadyCovered) continue;

      const candidates = getCandidates()
        .filter((emp) => emp.certifications.includes(cert))
        .sort(priorityOrder);
      if (candidates.length > 0) {
        const chosen = candidates[0];
        assignedSet.add(chosen.id);
        recordAssignment(chosen.id, target);
      }
    }

    while (assignedSet.size < target.required_headcount) {
      const candidates = getCandidates().sort(priorityOrder);
      if (candidates.length === 0) break;
      const chosen = candidates[0];
      assignedSet.add(chosen.id);
      recordAssignment(chosen.id, target);
    }
  }

  // Pass 1: fill every shift and event from its own sign-up list.
  for (const shift of shiftInstances) {
    const assignedToThisShift = new Set<string>();
    assignedByShift.set(shift.id, assignedToThisShift);
    fillFrom(
      shift,
      assignedToThisShift,
      () => eligibleCandidates(shift.id, assignedToThisShift, shift.date, shift.start_time, shift.end_time),
      byPriorityDesc
    );
  }

  // Pass 2: an event whose time is fully nested inside a regular shift can
  // borrow that shift's "leftover" sign-ups — people who wanted the shift
  // but didn't make the cut because it already reached headcount with
  // higher-priority candidates. Nobody actually assigned to the shift is
  // touched; only people who signed up but weren't selected are eligible,
  // lowest priority first, since they weren't going to work the shift
  // anyway. This only ever helps an event that's still short — it never
  // reduces an already-full event.
  for (const event of shiftInstances) {
    if (!event.is_event) continue;
    const assignedToEvent = assignedByShift.get(event.id)!;
    const containingShifts = shiftInstances.filter((s) => isNestedInShift(event, s));
    if (containingShifts.length === 0) continue;

    fillFrom(
      event,
      assignedToEvent,
      () => {
        const seen = new Set<string>();
        const pool: Employee[] = [];
        for (const shift of containingShifts) {
          for (const emp of eligibleCandidates(
            shift.id,
            assignedToEvent,
            event.date,
            event.start_time,
            event.end_time
          )) {
            if (!seen.has(emp.id)) {
              seen.add(emp.id);
              pool.push(emp);
            }
          }
        }
        return pool;
      },
      byPriorityAsc
    );
  }

  // Pass 3: employees still working toward the base certification sign up
  // like anyone else, and get added to any shift/event they're available
  // for as supplementary help — they never compete for or fill a real
  // slot (passes 1-2 only ever drew from trained employees), so adding
  // them can't mask a shortage. Weekly quota and same-day overlap rules
  // still apply normally.
  for (const shift of shiftInstances) {
    const countedSet = assignedByShift.get(shift.id)!;
    for (const emp of employees) {
      if (!emp.active || isTrained(emp)) continue;
      if (countedSet.has(emp.id)) continue;
      if (!availableSet.has(`${emp.id}:${shift.id}`)) continue;
      const desired = desiredCountByEmployee.get(emp.id) ?? 0;
      if ((assignedCount.get(emp.id) ?? 0) >= desired) continue;
      if (hasOverlapOnDay(emp.id, shift.date, shift.start_time, shift.end_time)) continue;
      recordAssignment(emp.id, shift);
    }
  }

  // Shortages are computed once at the end, from `assignedByShift` only —
  // reallocated (pass 2) people count, bonus in-training people (pass 3)
  // never do.
  const shortages: Shortage[] = [];
  for (const shift of shiftInstances) {
    const assignedToThisShift = assignedByShift.get(shift.id)!;
    const missingHeadcount = Math.max(0, shift.required_headcount - assignedToThisShift.size);
    const missingCertifications = shift.required_certifications.filter(
      (cert) =>
        !Array.from(assignedToThisShift).some((id) => employeeById.get(id)?.certifications.includes(cert))
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
