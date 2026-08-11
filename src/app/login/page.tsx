"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/auth/username";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });

    setLoading(false);

    if (signInError || !data.user) {
      setError("שם משתמש או סיסמה שגויים");
      return;
    }

    const role = (data.user.app_metadata as { role?: string } | null)?.role;
    router.push(role === "manager" ? "/employees" : "/my-schedule");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded border border-border bg-surface p-8"
      >
        <h1 className="mb-1 text-2xl font-extrabold text-brand">ג&apos;אמפו</h1>
        <p className="mb-6 text-sm text-text-muted">כניסה לניהול המשמרות</p>

        <label className="mb-1 block text-sm font-semibold text-text">
          שם משתמש
        </label>
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="mb-4 w-full rounded border border-border px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />

        <label className="mb-1 block text-sm font-semibold text-text">
          סיסמה
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-4 w-full rounded border border-border px-3 py-2 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />

        {error && <p className="mb-4 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? "מתחבר..." : "התחברות"}
        </button>
      </form>
    </div>
  );
}
