"use client";

import { useState } from "react";
import type { Employee } from "@/types/database";
import { isTrained } from "@/lib/constants";
import EmployeeForm, { type EmployeeFormValues } from "./employee-form";

export default function EmployeesClient({
  initialEmployees,
  certifications,
}: {
  initialEmployees: Employee[];
  certifications: string[];
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleAdd(values: EmployeeFormValues) {
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json();
    if (!res.ok) return body.error ?? "שגיאה";

    setEmployees((prev) => [
      ...prev,
      {
        id: body.id,
        full_name: values.full_name,
        username: values.username,
        email: values.email || null,
        role: "employee",
        certifications: values.certifications,
        priority: values.priority,
        active: true,
        created_at: new Date().toISOString(),
      },
    ]);
    setShowAddForm(false);
    return null;
  }

  async function handleEdit(id: string, values: EmployeeFormValues) {
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: values.full_name,
        email: values.email,
        certifications: values.certifications,
        priority: values.priority,
        password: values.password || undefined,
      }),
    });
    const body = await res.json();
    if (!res.ok) return body.error ?? "שגיאה";

    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === id
          ? {
              ...emp,
              full_name: values.full_name,
              email: values.email || null,
              certifications: values.certifications,
              priority: values.priority,
            }
          : emp
      )
    );
    setEditingId(null);
    return null;
  }

  async function toggleActive(employee: Employee) {
    const nextActive = !employee.active;
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    });
    if (!res.ok) return;
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === employee.id ? { ...emp, active: nextActive } : emp))
    );
  }

  async function handleDelete(employee: Employee) {
    const confirmed = confirm(
      `למחוק לצמיתות את ${employee.full_name}?\n\n` +
        "הפעולה בלתי הפיכה — כל היסטוריית השיבוצים, הזמינות וההודעות שלו/ה תימחק גם היא, כולל ממחזורים שכבר פורסמו.\n\n" +
        'אם רק רוצים להוציא אותו/ה משימוש בלי לאבד היסטוריה — עדיף "השבתה" ולא מחיקה.'
    );
    if (!confirmed) return;

    const res = await fetch(`/api/employees/${employee.id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error ?? "שגיאה במחיקת העובד");
      return;
    }
    setEmployees((prev) => prev.filter((emp) => emp.id !== employee.id));
  }

  return (
    <div>
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="mb-4 rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          + הוספת עובד
        </button>
      )}

      {showAddForm && (
        <EmployeeForm
          certifications={certifications}
          onSubmit={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="overflow-x-auto rounded border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-right text-text-muted">
              <th className="px-4 py-3 text-[13px] font-semibold">שם מלא</th>
              <th className="px-4 py-3 text-[13px] font-semibold">שם משתמש</th>
              <th className="px-4 py-3 text-[13px] font-semibold">הסמכות</th>
              <th className="px-4 py-3 text-[13px] font-semibold">עדיפות</th>
              <th className="px-4 py-3 text-[13px] font-semibold">סטטוס</th>
              <th className="px-4 py-3 text-[13px] font-semibold">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) =>
              editingId === employee.id ? (
                <tr key={employee.id}>
                  <td colSpan={6} className="p-4">
                    <EmployeeForm
                      employee={employee}
                      certifications={certifications}
                      onSubmit={(values) => handleEdit(employee.id, values)}
                      onCancel={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              ) : (
                <tr
                  key={employee.id}
                  className={`border-b border-border-soft last:border-0 ${
                    employee.active ? "" : "opacity-50"
                  }`}
                >
                  <td className="px-4 py-3.5">{employee.full_name}</td>
                  <td className="px-4 py-3.5 tabular-nums text-text-muted">{employee.username}</td>
                  <td className="px-4 py-3.5">{employee.certifications.join(", ") || "—"}</td>
                  <td className="px-4 py-3.5 tabular-nums">{employee.priority}</td>
                  <td className="px-4 py-3.5">
                    {employee.active ? (
                      isTrained(employee) ? (
                        <span className="rounded bg-success-bg px-3 py-1 text-xs font-semibold text-success">
                          פעיל
                        </span>
                      ) : (
                        <span className="rounded bg-amber-bg px-3 py-1 text-xs font-semibold text-amber">
                          בהכשרה
                        </span>
                      )
                    ) : (
                      <span className="rounded bg-border-soft px-3 py-1 text-xs font-semibold text-text-muted">
                        מושבת
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-4">
                      <button
                        onClick={() => setEditingId(employee.id)}
                        className="text-brand"
                      >
                        עריכה
                      </button>
                      <button
                        onClick={() => toggleActive(employee)}
                        className="text-text-muted"
                      >
                        {employee.active ? "השבתה" : "הפעלה"}
                      </button>
                      <button
                        onClick={() => handleDelete(employee)}
                        className="text-danger"
                      >
                        מחיקה
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {employees.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  אין עדיין עובדים במערכת
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
