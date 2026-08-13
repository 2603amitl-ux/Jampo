"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CalendarSettings as CalendarSettingsRow } from "@/types/database";

export default function CalendarSettings({ settings }: { settings: CalendarSettingsRow | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [url, setUrl] = useState(settings?.ical_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const { error } = await supabase
      .from("calendar_settings")
      .update({ ical_url: url.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", settings.id);
    setBusy(false);
    if (error) {
      setError("שגיאה בשמירה");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mb-4 rounded border border-border bg-surface p-4">
      <h2 className="mb-1 text-lg font-bold">יומן Google — ייבוא אירועים אוטומטי</h2>
      <p className="mb-3 text-sm text-text-muted">
        בכל פתיחת מחזור חדש, אירועים מהיומן שנופלים בטווח התאריכים שלו יתווספו אוטומטית
        כ&quot;אירועים&quot;, בדיוק כמו הוספה ידנית. את הכתובת מוצאים ב-Google Calendar: הגדרות
        היומן (⚙) ← &quot;הגדרות ושיתוף&quot; ← &quot;שילוב היומן&quot; ← &quot;כתובת בסוד בפורמט
        iCal&quot;.
      </p>
      <form onSubmit={handleSave} className="flex flex-wrap gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
          dir="ltr"
          className="min-w-0 flex-1 rounded border border-border px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          שמירה
        </button>
      </form>
      {saved && <p className="mt-2 text-sm text-success">נשמר.</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
