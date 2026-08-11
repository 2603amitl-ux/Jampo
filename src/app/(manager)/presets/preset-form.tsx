"use client";

import { useState } from "react";
import { ALL_CERTIFICATIONS } from "@/lib/constants";
import type { Certification, ShiftPreset } from "@/types/database";

export interface PresetFormValues {
  shift_name: string;
  start_time: string;
  end_time: string;
  base_headcount: number;
  required_certifications: Certification[];
}

export default function PresetForm({
  preset,
  onSubmit,
  onCancel,
}: {
  preset?: ShiftPreset;
  onSubmit: (values: PresetFormValues) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [shiftName, setShiftName] = useState(preset?.shift_name ?? "");
  const [startTime, setStartTime] = useState(preset?.start_time.slice(0, 5) ?? "09:00");
  const [endTime, setEndTime] = useState(preset?.end_time.slice(0, 5) ?? "13:00");
  const [baseHeadcount, setBaseHeadcount] = useState(preset?.base_headcount ?? 1);
  const [certifications, setCertifications] = useState<Certification[]>(
    preset?.required_certifications ?? []
  );
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

    if (endTime <= startTime) {
      setError("שעת סיום חייבת להיות אחרי שעת התחלה");
      return;
    }

    setSaving(true);
    const result = await onSubmit({
      shift_name: shiftName,
      start_time: startTime,
      end_time: endTime,
      base_headcount: baseHeadcount,
      required_certifications: certifications,
    });
    setSaving(false);
    if (result) setError(result);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 rounded border border-border bg-bg p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-text-muted">שם המשמרת</label>
          <input
            type="text"
            required
            value={shiftName}
            onChange={(e) => setShiftName(e.target.value)}
            placeholder="בוקר / צהריים / ערב"
            className="w-full rounded border border-border px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-text-muted">שעת התחלה</label>
          <input
            type="time"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded border border-border px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-text-muted">שעת סיום</label>
          <input
            type="time"
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded border border-border px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-text-muted">כמות עובדים בסיסית</label>
          <input
            type="number"
            min={0}
            required
            value={baseHeadcount}
            onChange={(e) => setBaseHeadcount(Number(e.target.value))}
            className="w-full rounded border border-border px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>

      <div className="mt-3">
        <span className="mb-1 block text-xs font-semibold text-text-muted">הסמכות נדרשות</span>
        <div className="flex gap-4">
          {ALL_CERTIFICATIONS.map((cert) => (
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
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {saving ? "שומר..." : "שמירה"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-3 py-1.5 text-sm font-semibold text-text-muted hover:text-text"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
