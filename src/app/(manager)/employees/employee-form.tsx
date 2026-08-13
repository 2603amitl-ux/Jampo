"use client";

import { useState } from "react";
import type { Certification, Employee } from "@/types/database";

export interface EmployeeFormValues {
  full_name: string;
  username: string;
  email: string;
  password: string;
  certifications: Certification[];
  priority: number;
}

export default function EmployeeForm({
  employee,
  certifications: allCertifications,
  onSubmit,
  onCancel,
}: {
  employee?: Employee;
  certifications: Certification[];
  onSubmit: (values: EmployeeFormValues) => Promise<string | null>;
  onCancel: () => void;
}) {
  const isEdit = Boolean(employee);
  const [fullName, setFullName] = useState(employee?.full_name ?? "");
  const [username, setUsername] = useState(employee?.username ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [password, setPassword] = useState("");
  const [certifications, setCertifications] = useState<Certification[]>(
    employee?.certifications ?? []
  );
  const [priority, setPriority] = useState(employee?.priority ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleCert(cert: Certification) {
    setCertifications((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const result = await onSubmit({
      full_name: fullName,
      username,
      email,
      password,
      certifications,
      priority,
    });
    setSaving(false);
    if (result) setError(result);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded border border-border bg-surface p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-text">שם מלא</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded border border-border px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-text">שם משתמש</label>
          <input
            type="text"
            required
            disabled={isEdit}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="אותיות/ספרות באנגלית"
            className="w-full rounded border border-border px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:bg-border-soft disabled:text-text-muted"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-text">
            אימייל (לשליחת תזכורות והודעות שיבוץ, אופציונלי)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-border px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-text">
            {isEdit ? "איפוס סיסמה (השאר ריק אם לא רוצים לשנות)" : "סיסמה ראשונית"}
          </label>
          <input
            type="text"
            required={!isEdit}
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-border px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-text">
            עדיפות (מספר גבוה יותר = עדיפות גבוהה יותר בשיבוץ)
          </label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full rounded border border-border px-3 py-2 tabular-nums focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>

      <div className="mt-4">
        <span className="mb-1 block text-sm font-semibold text-text">הסמכות</span>
        <div className="flex flex-wrap gap-4">
          {allCertifications.map((cert) => (
            <label key={cert} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={certifications.includes(cert)}
                onChange={() => toggleCert(cert)}
                className="rounded border-border"
              />
              {cert}
            </label>
          ))}
          {allCertifications.length === 0 && (
            <span className="text-sm text-text-muted">
              אין עדיין הסמכות מוגדרות — אפשר להוסיף במסך &quot;הגדרות&quot;.
            </span>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {saving ? "שומר..." : "שמירה"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-4 py-2 text-sm font-semibold text-text-muted hover:text-text"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
