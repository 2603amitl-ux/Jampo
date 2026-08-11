import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role client — bypasses RLS entirely. Never import this from
// client components or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// Used for: creating employee logins, and the scheduling algorithm, which
// needs to read every employee's availability and write assignments for
// everyone at once.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
