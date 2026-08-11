import { createClient } from "@/lib/supabase/server";
import EmployeesClient from "./employees-client";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .order("active", { ascending: false })
    .order("priority", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">ניהול עובדים</h1>
      <EmployeesClient initialEmployees={employees ?? []} />
    </div>
  );
}
