import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ManagerNav from "./manager-nav";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = (user?.app_metadata as { role?: string } | null)?.role;
  if (!user || role !== "manager") {
    // Defense in depth — middleware already redirects non-managers away
    // from these routes.
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <ManagerNav />
      <main className="mx-auto max-w-screen-2xl px-4 py-6">{children}</main>
    </div>
  );
}
