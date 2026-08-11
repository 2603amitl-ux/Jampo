import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { DateText } from "@/components/date-text";
import PeriodDetailClient from "./period-detail-client";

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();

  const { data: period } = await supabase
    .from("schedule_periods")
    .select("*")
    .eq("id", id)
    .single();
  if (!period) notFound();

  const { data: instances } = await supabase
    .from("shift_instances")
    .select("*")
    .eq("schedule_period_id", id)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  const instanceIds = (instances ?? []).map((i) => i.id);

  const { data: assignments } = await supabase
    .from("assignments")
    .select("*")
    .in("shift_instance_id", instanceIds.length > 0 ? instanceIds : ["00000000-0000-0000-0000-000000000000"]);

  // Not filtered to active=true: employees who were later deactivated must
  // still resolve to their name in past (published) periods, not "?". The
  // client filters to active employees itself wherever it builds a
  // candidate pool (manual assignment dropdown, algorithm input).
  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .eq("role", "employee")
    .order("priority", { ascending: false });

  const { data: availability } = await supabase
    .from("availability")
    .select("*")
    .in("shift_instance_id", instanceIds.length > 0 ? instanceIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: weeklyRequests } = await supabase
    .from("weekly_shift_requests")
    .select("*")
    .eq("schedule_period_id", id);

  const { data: certifications } = await supabase
    .from("certifications")
    .select("name")
    .order("name", { ascending: true });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">
        מחזור <DateText date={period.end_date} /> – <DateText date={period.start_date} />
      </h1>
      <PeriodDetailClient
        period={period}
        initialInstances={instances ?? []}
        initialAssignments={assignments ?? []}
        employees={employees ?? []}
        availability={availability ?? []}
        weeklyRequests={weeklyRequests ?? []}
        allCertifications={(certifications ?? []).map((c) => c.name)}
      />
    </div>
  );
}
