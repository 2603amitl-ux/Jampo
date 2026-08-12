"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/availability", label: "הגשת זמינות" },
  { href: "/my-schedule", label: "השיבוץ שלי" },
  { href: "/future-unavailability", label: "תכנון קדימה" },
];

export default function EmployeeNav() {
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-screen-xl items-center gap-3 px-4">
        <span className="shrink-0 text-lg font-extrabold text-brand">ג&apos;אמפו</span>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded px-3 py-1.5 text-sm font-semibold transition ${
                pathname.startsWith(link.href)
                  ? "bg-brand-soft text-brand"
                  : "text-text-muted hover:bg-border-soft"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <button
          onClick={handleSignOut}
          className="shrink-0 text-sm text-text-muted hover:text-text"
        >
          התנתקות
        </button>
      </div>
    </nav>
  );
}
