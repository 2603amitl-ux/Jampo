"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DAY_NAMES, PERIOD_STATUS_LABELS, isTrained } from "@/lib/constants";
import { DateText } from "@/components/date-text";
import type {
  Assignment,
  Availability,
  Employee,
  SchedulePeriod,
  ShiftInstance,
  WeeklyShiftRequest,
} from "@/types/database";
import InstanceEditForm, { type InstanceEditValues } from "./instance-edit-form";
import EventForm, { type EventFormValues } from "./event-form";
import ScheduleSummaryTable from "./schedule-summary-table";

export default function PeriodDetailClient({
  period,
  initialInstances,
  initialAssignments,
  employees,
  availability,
  weeklyRequests,
  allCertifications,
}: {
  period: SchedulePeriod;
  initialInstances: ShiftInstance[];
  initialAssignments: Assignment[];
  employees: Employee[];
  availability: Availability[];
  weeklyRequests: WeeklyShiftRequest[];
  allCertifications: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState(period.status);
  const [instances, setInstances] = useState(initialInstances);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingEventForDate, setAddingEventForDate] = useState<string | null>(null);
  const [addingAssigneeFor, setAddingAssigneeFor] = useState<string | null>(null);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);
  const [buildMessage, setBuildMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shownCollectingEventWarning, setShownCollectingEventWarning] = useState(false);
  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<string | null>(null);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const availableSet = useMemo(
    () =>
      new Set(
        availability.filter((a) => a.is_available).map((a) => `${a.employee_id}:${a.shift_instance_id}`)
      ),
    [availability]
  );
  const desiredCountByEmployee = useMemo(
    () => new Map(weeklyRequests.map((r) => [r.employee_id, r.desired_shift_count])),
    [weeklyRequests]
  );
  const assignedCountByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assignments) map.set(a.employee_id, (map.get(a.employee_id) ?? 0) + 1);
    return map;
  }, [assignments]);
  // Assignments per employee in creation order — lets us blame quota overages
  // on whichever specific assignment pushed them past "desired", instead of
  // flagging every one of that employee's shifts for the whole week.
  const sortedAssignmentsByEmployee = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const list = map.get(a.employee_id) ?? [];
      list.push(a);
      map.set(a.employee_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return map;
  }, [assignments]);

  const dates = Array.from(new Set(instances.map((i) => i.date))).sort();

  async function handleOpenCollecting() {
    setBusy(true);
    const { error } = await supabase
      .from("schedule_periods")
      .update({ status: "collecting" })
      .eq("id", period.id);
    setBusy(false);
    if (!error) {
      setStatus("collecting");
      router.refresh();
    }
  }

  // Reopening only flips the status back to "collecting" — it never touches
  // availability/weekly_shift_requests, so whatever employees already
  // submitted stays marked and simply becomes editable again.
  async function handleReopenForSubmission() {
    setBusy(true);
    const { error } = await supabase
      .from("schedule_periods")
      .update({ status: "collecting" })
      .eq("id", period.id);
    setBusy(false);
    if (!error) {
      setStatus("collecting");
      setBuildMessage(null);
      router.refresh();
    }
  }

  async function handleNotify() {
    setBusy(true);
    setNotifyMessage(null);
    const res = await fetch(`/api/periods/${period.id}/notify-availability`, { method: "POST" });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotifyMessage(body.error ?? "שגיאה בשליחת התזכורות");
      return;
    }
    if (body.error) {
      setNotifyMessage(body.error);
      return;
    }
    setNotifyMessage(
      `נשלחו ${body.sent} תזכורות${body.skipped ? ` (${body.skipped} עובדים ללא אימייל רשום דולגו)` : ""}`
    );
  }

  async function handleBuildSchedule() {
    if (status === "generated") {
      const confirmed = confirm(
        "בנייה מחדש תמחק את כל השיבוצים הקיימים במחזור הזה — כולל שיבוצים שהוספת ידנית — ותבנה אותם מחדש מאפס. להמשיך?"
      );
      if (!confirmed) return;
    }
    setBusy(true);
    setBuildMessage(null);
    const res = await fetch(`/api/periods/${period.id}/build-schedule`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      setBusy(false);
      setBuildMessage(body.error ?? "שגיאה בבניית השיבוץ");
      return;
    }

    const instanceIds = instances.map((i) => i.id);
    const { data: freshAssignments } = await supabase
      .from("assignments")
      .select("*")
      .in("shift_instance_id", instanceIds.length > 0 ? instanceIds : ["00000000-0000-0000-0000-000000000000"]);

    setBusy(false);
    setAssignments(freshAssignments ?? []);
    setStatus("generated");
    setBuildMessage(
      body.shortages.length > 0
        ? `השיבוץ נבנה. ${body.shortages.length} משמרות עם חוסר — מסומנות למטה.`
        : "השיבוץ נבנה בהצלחה, כל המשמרות מכוסות."
    );
  }

  async function handlePublish() {
    setBusy(true);
    setBuildMessage(null);
    const res = await fetch(`/api/periods/${period.id}/publish`, { method: "POST" });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setBuildMessage(body.error ?? "שגיאה בפרסום");
      return;
    }
    setStatus("published");
    setBuildMessage(
      body.error ?? `פורסם! נשלחו ${body.sent ?? 0} מיילים${body.skipped ? ` (${body.skipped} דולגו)` : ""}`
    );
  }

  async function handleEditInstance(id: string, values: InstanceEditValues) {
    const { data, error } = await supabase
      .from("shift_instances")
      .update(values)
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return "שגיאה בעדכון המשמרת";
    setInstances((prev) => prev.map((i) => (i.id === id ? data : i)));
    setEditingId(null);
    return null;
  }

  async function handleAddEvent(values: EventFormValues) {
    const res = await fetch(`/api/periods/${period.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "שגיאה";
    setInstances((prev) => [...prev, data]);
    setAddingEventForDate(null);
    return null;
  }

  async function handleAddAssignment(shift: ShiftInstance, employeeId: string) {
    const { data, error } = await supabase
      .from("assignments")
      .insert({ shift_instance_id: shift.id, employee_id: employeeId, assigned_by: "manager" })
      .select()
      .single();
    setAddingAssigneeFor(null);
    if (error || !data) return;
    setAssignments((prev) => [...prev, data]);
  }

  async function handleRemoveAssignment(assignmentId: string) {
    const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);
    if (error) return;
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
  }

  // Pre-check before adding a new manual assignment — "current" here is the
  // count *before* this one is added, so ">=" correctly means "adding this
  // one would push them to/over their quota".
  function assignmentWarning(shift: ShiftInstance, employeeId: string): string | null {
    const warnings: string[] = [];
    if (!availableSet.has(`${employeeId}:${shift.id}`)) {
      warnings.push("העובד/ת לא סימנ/ה זמינות למשמרת זו");
    }
    const desired = desiredCountByEmployee.get(employeeId) ?? 0;
    const current = assignedCountByEmployee.get(employeeId) ?? 0;
    if (current >= desired) {
      warnings.push("חורג מכמות המשמרות שביקש/ה");
    }
    return warnings.length > 0 ? warnings.join(" · ") : null;
  }

  // Same idea, but for an assignment that already exists. Quota is attributed
  // to a *specific* assignment (by creation order) rather than the employee's
  // whole week, so only the shift(s) that actually pushed them over quota are
  // flagged — not every shift they happen to be assigned that week.
  function existingAssignmentWarning(
    shift: ShiftInstance,
    employeeId: string,
    assignmentId: string
  ): string | null {
    const warnings: string[] = [];
    if (!availableSet.has(`${employeeId}:${shift.id}`)) {
      warnings.push("לא סימנ/ה זמינות למשמרת זו");
    }
    const desired = desiredCountByEmployee.get(employeeId) ?? 0;
    const employeeAssignments = sortedAssignmentsByEmployee.get(employeeId) ?? [];
    const index = employeeAssignments.findIndex((a) => a.id === assignmentId);
    if (index >= desired) {
      warnings.push("חורג/ת ממכסת המשמרות שביקש/ה");
    }
    return warnings.length > 0 ? warnings.join(" · ") : null;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="rounded bg-border-soft px-3 py-1 text-sm font-semibold text-text-muted">
          {PERIOD_STATUS_LABELS[status]}
        </span>

        {status === "draft" && (
          <button
            onClick={handleOpenCollecting}
            disabled={busy}
            className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
          >
            פתיחה להגשת זמינות
          </button>
        )}

        {status === "collecting" && (
          <>
            <button
              onClick={handleNotify}
              disabled={busy}
              className="rounded bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand disabled:opacity-50"
            >
              שליחת תזכורת לעובדים
            </button>
            <button
              onClick={handleBuildSchedule}
              disabled={busy}
              className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              בניית הצעת שיבוץ
            </button>
          </>
        )}

        {status === "generated" && (
          <>
            <button
              onClick={handleReopenForSubmission}
              disabled={busy}
              className="rounded bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand disabled:opacity-50"
            >
              פתיחה מחדש להגשה
            </button>
            <button
              onClick={handleBuildSchedule}
              disabled={busy}
              className="rounded bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand disabled:opacity-50"
            >
              בנה מחדש
            </button>
            <button
              onClick={handlePublish}
              disabled={busy}
              className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              פרסום ללוח
            </button>
          </>
        )}
      </div>

      {notifyMessage && <p className="mb-2 text-sm text-text-muted">{notifyMessage}</p>}
      {buildMessage && <p className="mb-4 text-sm text-text-muted">{buildMessage}</p>}

      <div className="overflow-x-auto pb-2">
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
          {dates.map((date) => {
            const dayInstances = instances
              .filter((i) => i.date === date)
              .sort((a, b) => a.start_time.localeCompare(b.start_time));
            const dayName = DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];

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
                    const shiftAssignments = assignments.filter(
                      (a) => a.shift_instance_id === instance.id
                    );
                    // Employees still in training (no base certification) are shown as
                    // assigned but never count toward headcount/certification coverage —
                    // they're supplementary, not a substitute for real staffing.
                    const countedAssignments = shiftAssignments.filter((a) => {
                      const emp = employeeById.get(a.employee_id);
                      return emp ? isTrained(emp) : false;
                    });
                    const missingHeadcount = Math.max(
                      0,
                      instance.required_headcount - countedAssignments.length
                    );
                    const missingCerts = instance.required_certifications.filter(
                      (cert) =>
                        !countedAssignments.some((a) =>
                          employeeById.get(a.employee_id)?.certifications.includes(cert)
                        )
                    );
                    const hasShortage = missingHeadcount > 0 || missingCerts.length > 0;
                    const availableEmployees = employees.filter(
                      (e) => e.active && !shiftAssignments.some((a) => a.employee_id === e.id)
                    );

                    const isBuilt = status === "generated" || status === "published";
                    // Fill reflects staffing status the same way for every shift, event
                    // or not — only the border marks a card as a non-standard event, so
                    // it stands out without hiding whether it's actually covered.
                    const fillClass = isBuilt ? (hasShortage ? "bg-danger-bg" : "bg-success-bg") : "bg-bg";
                    const borderClass = instance.is_event
                      ? "border-amber"
                      : isBuilt
                        ? hasShortage
                          ? "border-danger-border"
                          : "border-success"
                        : "border-border-soft";

                    return (
                      <div
                        key={instance.id}
                        className={`rounded border px-2 py-1.5 text-right text-xs ${borderClass} ${fillClass}`}
                      >
                        {(() => {
                          const canEditShift = status === "draft" || status === "collecting";
                          const Tag = canEditShift ? "button" : "div";
                          return (
                            <Tag
                              onClick={canEditShift ? () => setEditingId(instance.id) : undefined}
                              className="w-full text-right"
                            >
                              <div className="font-bold">{instance.shift_name}</div>
                              <div className="text-text-muted">
                                <bdi dir="ltr">
                                  {instance.start_time.slice(0, 5)}–{instance.end_time.slice(0, 5)}
                                </bdi>
                              </div>
                              <div className="text-text-muted">
                                {instance.required_headcount} עובדים
                                {instance.required_certifications.length > 0 &&
                                  ` · ${instance.required_certifications.join(", ")}`}
                              </div>
                              {instance.event_note && (
                                <div className="text-amber">{instance.event_note}</div>
                              )}
                            </Tag>
                          );
                        })()}

                        {status === "collecting" && (
                          <div className="mt-1.5 border-t border-border-soft pt-1.5">
                            {(() => {
                              const interested = employees.filter(
                                (e) => e.active && availableSet.has(`${e.id}:${instance.id}`)
                              );
                              return interested.length === 0 ? (
                                <div className="text-text-muted">אף אחד עדיין לא סימן</div>
                              ) : (
                                <div className="text-text-muted">
                                  {interested.length} מועמדים: {interested.map((e) => e.full_name).join(", ")}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {(status === "generated" || status === "published") && (
                          <div className="mt-1.5 border-t border-border-soft pt-1.5">
                            {shiftAssignments.length === 0 && (
                              <div className="text-text-muted">אין משובצים</div>
                            )}
                            <div className="flex flex-wrap gap-1">
                              {shiftAssignments.map((a) => {
                                const warning = existingAssignmentWarning(instance, a.employee_id, a.id);
                                const isHighlighted = highlightedEmployeeId === a.employee_id;
                                const assignee = employeeById.get(a.employee_id);
                                const inTraining = assignee ? !isTrained(assignee) : false;
                                return (
                                <div
                                  key={a.id}
                                  title={warning ?? undefined}
                                  onClick={() =>
                                    setHighlightedEmployeeId((prev) =>
                                      prev === a.employee_id ? null : a.employee_id
                                    )
                                  }
                                  className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 ${
                                    isHighlighted
                                      ? "border-brand bg-brand-soft ring-2 ring-brand"
                                      : warning
                                        ? "border-amber-bg bg-amber-bg"
                                        : "border-border-soft bg-surface"
                                  }`}
                                >
                                  {warning && <span className="text-amber">⚠</span>}
                                  <span>{assignee?.full_name ?? "?"}</span>
                                  {inTraining && <span className="text-text-muted">(בהכשרה)</span>}
                                  {status !== "published" && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveAssignment(a.id);
                                      }}
                                      className="text-danger"
                                    >
                                      הסרה
                                    </button>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                            {hasShortage && (
                              <div className="mt-1 space-y-0.5 text-danger">
                                {missingHeadcount > 0 && <div>חסרים {missingHeadcount} עובדים</div>}
                                {missingCerts.length > 0 && (
                                  <div>חסרה הסמכה: {missingCerts.join(", ")}</div>
                                )}
                              </div>
                            )}
                            {status === "generated" && (
                              addingAssigneeFor === instance.id ? (
                                <select
                                  autoFocus
                                  onChange={(e) => {
                                    if (e.target.value) handleAddAssignment(instance, e.target.value);
                                  }}
                                  onBlur={() => setAddingAssigneeFor(null)}
                                  className="mt-1 w-full rounded border border-border px-1 py-0.5"
                                >
                                  <option value="">בחר/י עובד/ת</option>
                                  {availableEmployees.map((e) => (
                                    <option key={e.id} value={e.id}>
                                      {e.full_name}
                                      {!isTrained(e) ? " (בהכשרה)" : ""}
                                      {assignmentWarning(instance, e.id) ? " ⚠" : ""}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <button
                                  onClick={() => setAddingAssigneeFor(instance.id)}
                                  className="mt-1 text-brand"
                                >
                                  + שיבוץ עובד/ת
                                </button>
                              )
                            )}
                          </div>
                        )}

                        {editingId === instance.id && (
                          <div className="mt-1.5 border-t border-border-soft pt-1.5">
                            <InstanceEditForm
                              initial={{
                                required_headcount: instance.required_headcount,
                                required_certifications: instance.required_certifications,
                              }}
                              allCertifications={allCertifications}
                              onSubmit={(values) => handleEditInstance(instance.id, values)}
                              onCancel={() => setEditingId(null)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {addingEventForDate === date ? (
                  <EventForm
                    date={date}
                    allCertifications={allCertifications}
                    onSubmit={handleAddEvent}
                    onCancel={() => setAddingEventForDate(null)}
                  />
                ) : (
                  status !== "published" && (
                    <button
                      onClick={() => {
                        if (status === "collecting" && !shownCollectingEventWarning) {
                          setShownCollectingEventWarning(true);
                          alert(
                            "שימו לב: המחזור כבר פתוח להגשת זמינות. משמרת חדשה שתוסיפו לא תופיע אוטומטית אצל עובדים שכבר הגישו — כדאי לשלוח תזכורת נוספת אחרי ההוספה."
                          );
                        }
                        setAddingEventForDate(date);
                      }}
                      className="mt-1.5 w-full rounded border border-dashed border-border py-1 text-xs text-text-muted hover:border-brand hover:text-brand"
                    >
                      + אירוע
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {(status === "generated" || status === "published") && (
        <ScheduleSummaryTable
          employees={employees}
          instances={instances}
          availability={availability}
          weeklyRequests={weeklyRequests}
          assignments={assignments}
          selectedEmployeeId={highlightedEmployeeId}
          onSelectEmployee={(id) =>
            setHighlightedEmployeeId((prev) => (prev === id ? null : id))
          }
        />
      )}
    </div>
  );
}
