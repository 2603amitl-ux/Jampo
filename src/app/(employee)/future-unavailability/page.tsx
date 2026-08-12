import { createClient } from "@/lib/supabase/server";
import FutureUnavailabilityClient from "./future-unavailability-client";

export default async function FutureUnavailabilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: entries } = await supabase
    .from("employee_unavailability")
    .select("*")
    .eq("employee_id", user!.id)
    .order("start_date", { ascending: true });

  return <FutureUnavailabilityClient initialEntries={entries ?? []} />;
}
