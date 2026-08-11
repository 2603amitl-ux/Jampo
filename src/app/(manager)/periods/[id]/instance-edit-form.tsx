"use client";

import { useState } from "react";
import { ALL_CERTIFICATIONS } from "@/lib/constants";
import type { Certification } from "@/types/database";

export interface InstanceEditValues {
  required_headcount: number;
  required_certifications: Certification[];
}

export default function InstanceEditForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: InstanceEditValues;
  onSubmit: (values: InstanceEditValues) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [headcount, setHeadcount] = useState(initial.required_headcount);
  const [certifications, setCertifications] = useState<Certification[]>(
    initial.required_certifications
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
    setSaving(true);
    const result = await onSubmit({
      required_headcount: headcount,
      required_certifications: certifications,
    });
    setSaving(false);
    if (result) setError(result);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-1.5 rounded bg-surface p-1.5 text-xs">
      <label className="block">
        <span className="mb-0.5 block text-text-muted">כמות עובדים</span>
        <input
          type="number"
          min={0}
          value={headcount}
          onChange={(e) => setHeadcount(Number(e.target.value))}
          className="w-full rounded border border-border px-1.5 py-1 text-sm tabular-nums"
        />
      </label>
      <div className="flex flex-col gap-1">
        {ALL_CERTIFICATIONS.map((cert) => (
          <label key={cert} className="flex items-center gap-1">
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
      {error && <p className="text-danger">{error}</p>}
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-brand px-2 py-1 font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {saving ? "שומר..." : "שמירה"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-1 text-text-muted hover:text-text"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
