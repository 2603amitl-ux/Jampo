"use client";

import { useState } from "react";
import type { Certification } from "@/types/database";

export interface EventFormValues {
  date: string;
  title: string;
  start_time: string;
  end_time: string;
  required_headcount: number;
  required_certifications: Certification[];
  note: string;
}

export default function EventForm({
  date,
  allCertifications,
  onSubmit,
  onCancel,
}: {
  date: string;
  allCertifications: Certification[];
  onSubmit: (values: EventFormValues) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("15:00");
  const [endTime, setEndTime] = useState("17:00");
  const [headcount, setHeadcount] = useState(1);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [note, setNote] = useState("");
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
      date,
      title,
      start_time: startTime,
      end_time: endTime,
      required_headcount: headcount,
      required_certifications: certifications,
      note,
    });
    setSaving(false);
    if (result) setError(result);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-2 rounded border border-amber-bg bg-amber-bg p-2 text-xs">
      <input
        type="text"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="כותרת האירוע (למשל: יום הולדת)"
        className="mb-1.5 w-full rounded border border-border px-1.5 py-1"
      />
      <div className="mb-1.5 flex gap-1">
        <input
          type="time"
          required
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full min-w-0 rounded border border-border px-1.5 py-1"
        />
        <input
          type="time"
          required
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="w-full min-w-0 rounded border border-border px-1.5 py-1"
        />
      </div>
      <label className="mb-1.5 flex items-center gap-1.5">
        עובדים נדרשים
        <input
          type="number"
          min={0}
          value={headcount}
          onChange={(e) => setHeadcount(Number(e.target.value))}
          className="w-14 rounded border border-border px-1.5 py-1"
        />
      </label>
      <div className="mb-1.5 flex flex-wrap gap-2">
        {allCertifications.map((cert) => (
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
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="הערה (אופציונלי)"
        className="mb-1.5 w-full rounded border border-border px-1.5 py-1"
      />

      {error && <p className="mb-1.5 text-danger">{error}</p>}

      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-brand px-2 py-1 font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {saving ? "שומר..." : "הוספה"}
        </button>
        <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-text-muted hover:text-text">
          ביטול
        </button>
      </div>
    </form>
  );
}
