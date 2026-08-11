"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DAY_NAMES } from "@/lib/constants";
import type { ShiftPreset } from "@/types/database";
import PresetForm, { type PresetFormValues } from "./preset-form";

export default function PresetsClient({
  initialPresets,
}: {
  initialPresets: ShiftPreset[];
}) {
  const [presets, setPresets] = useState(initialPresets);
  const [addingForDay, setAddingForDay] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const supabase = createClient();

  async function handleAdd(day: number, values: PresetFormValues) {
    const { data, error } = await supabase
      .from("shift_presets")
      .insert({ day_of_week: day, ...values })
      .select()
      .single();

    if (error || !data) return "שגיאה בשמירת המשמרת";
    setPresets((prev) => [...prev, data]);
    setAddingForDay(null);
    return null;
  }

  async function handleEdit(id: string, values: PresetFormValues) {
    const { data, error } = await supabase
      .from("shift_presets")
      .update(values)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return "שגיאה בעדכון המשמרת";
    setPresets((prev) => prev.map((p) => (p.id === id ? data : p)));
    setEditingId(null);
    return null;
  }

  async function handleDelete(id: string) {
    if (!confirm("למחוק את המשמרת הזו מהפריסט?")) return;
    const { error } = await supabase.from("shift_presets").delete().eq("id", id);
    if (error) return;
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-4">
      {DAY_NAMES.map((dayName, day) => {
        const dayPresets = presets
          .filter((p) => p.day_of_week === day)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));

        return (
          <div key={day} className="rounded border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">יום {dayName}</h2>
              {addingForDay !== day && (
                <button
                  onClick={() => setAddingForDay(day)}
                  className="text-sm font-semibold text-brand"
                >
                  + הוספת משמרת
                </button>
              )}
            </div>

            {addingForDay === day && (
              <PresetForm
                onSubmit={(values) => handleAdd(day, values)}
                onCancel={() => setAddingForDay(null)}
              />
            )}

            {dayPresets.length === 0 && addingForDay !== day && (
              <p className="text-sm text-text-muted">אין משמרות מוגדרות ליום זה</p>
            )}

            <div className="space-y-2">
              {dayPresets.map((preset) =>
                editingId === preset.id ? (
                  <PresetForm
                    key={preset.id}
                    preset={preset}
                    onSubmit={(values) => handleEdit(preset.id, values)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div
                    key={preset.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-border-soft px-3 py-2"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{preset.shift_name}</span>
                      <span className="text-text-muted">
                        {" "}
                        <bdi dir="ltr">
                          {preset.start_time.slice(0, 5)}–{preset.end_time.slice(0, 5)}
                        </bdi>{" "}
                        · {preset.base_headcount} עובדים
                        {preset.required_certifications.length > 0 &&
                          ` · ${preset.required_certifications.join(", ")}`}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <button
                        onClick={() => setEditingId(preset.id)}
                        className="text-brand"
                      >
                        עריכה
                      </button>
                      <button
                        onClick={() => handleDelete(preset.id)}
                        className="text-danger"
                      >
                        מחיקה
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
