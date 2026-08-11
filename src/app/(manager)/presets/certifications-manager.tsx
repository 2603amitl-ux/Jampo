"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CertificationRow } from "@/types/database";

export default function CertificationsManager({
  certifications,
}: {
  certifications: CertificationRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("certifications").insert({ name });
    setBusy(false);
    if (error) {
      setError(error.message.includes("duplicate") ? "הסמכה כזו כבר קיימת" : "שגיאה בהוספה");
      return;
    }
    setNewName("");
    router.refresh();
  }

  async function handleRename(oldName: string) {
    const name = editingName.trim();
    if (!name || name === oldName) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("rename_certification", {
      old_name: oldName,
      new_name: name,
    });
    setBusy(false);
    if (error) {
      setError("שגיאה בשינוי השם");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(name: string) {
    if (
      !confirm(
        `למחוק את ההסמכה "${name}"? היא תוסר גם מכל העובדים והמשמרות שכבר משויכים אליה.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("delete_certification", { cert_name: name });
    setBusy(false);
    if (error) {
      setError("שגיאה במחיקה");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mb-4 rounded border border-border bg-surface p-4">
      <h2 className="mb-3 text-lg font-bold">הסמכות</h2>

      <div className="mb-3 flex flex-wrap gap-2">
        {certifications.map((cert) =>
          editingId === cert.id ? (
            <div key={cert.id} className="flex items-center gap-1">
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename(cert.name)}
                className="w-28 rounded border border-brand px-2 py-1 text-sm"
              />
              <button
                onClick={() => handleRename(cert.name)}
                disabled={busy}
                className="text-sm font-semibold text-brand"
              >
                שמירה
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="text-sm text-text-muted"
              >
                ביטול
              </button>
            </div>
          ) : (
            <div
              key={cert.id}
              className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-bg px-3 py-1 text-sm"
            >
              <span>{cert.name}</span>
              <button
                onClick={() => {
                  setEditingId(cert.id);
                  setEditingName(cert.name);
                }}
                className="text-brand"
              >
                עריכה
              </button>
              <button onClick={() => handleDelete(cert.name)} className="text-danger">
                מחיקה
              </button>
            </div>
          )
        )}
        {certifications.length === 0 && (
          <span className="text-sm text-text-muted">אין עדיין הסמכות</span>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="שם הסמכה חדשה"
          className="rounded border border-border px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          + הוספת הסמכה
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
