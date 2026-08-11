import "server-only";
import { createClient } from "@/lib/supabase/server";

// Route handlers use the admin (service-role) client to call Supabase Auth
// admin APIs, which bypasses RLS entirely — so every route that uses it
// must independently re-verify the caller is a manager before doing
// anything. RLS on the `employees` table is not enough on its own here.
export async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = (user?.app_metadata as { role?: string } | null)?.role;
  if (!user || role !== "manager") {
    return null;
  }
  return user;
}
