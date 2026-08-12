// Hand-written to match supabase/migrations/0001_init.sql.
// Once the project is linked, prefer regenerating with:
//   npx supabase gen types typescript --linked > src/types/database.ts

export type EmployeeRole = "manager" | "employee";
// Certifications are a manager-editable list (see the `certifications`
// table), not a fixed set — any string the manager has added is valid.
export type Certification = string;
export type PeriodStatus = "draft" | "collecting" | "generated" | "published";
export type AssignedBy = "algorithm" | "manager";

export interface Employee {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  role: EmployeeRole;
  certifications: Certification[];
  priority: number;
  active: boolean;
  created_at: string;
}

export interface ShiftPreset {
  id: string;
  day_of_week: number; // 0 (Sunday) - 6 (Saturday)
  shift_name: string;
  start_time: string; // HH:MM:SS
  end_time: string;
  base_headcount: number;
  required_certifications: Certification[];
  created_at: string;
}

export interface SchedulePeriod {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  status: PeriodStatus;
  created_at: string;
}

export interface ShiftInstance {
  id: string;
  schedule_period_id: string;
  date: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  required_headcount: number;
  required_certifications: Certification[];
  is_event: boolean;
  event_note: string | null;
  created_at: string;
}

export interface Availability {
  id: string;
  employee_id: string;
  shift_instance_id: string;
  is_available: boolean;
  updated_at: string;
}

export interface WeeklyShiftRequest {
  id: string;
  employee_id: string;
  schedule_period_id: string;
  desired_shift_count: number;
  updated_at: string;
}

export interface Assignment {
  id: string;
  shift_instance_id: string;
  employee_id: string;
  assigned_by: AssignedBy;
  created_at: string;
}

export interface CertificationRow {
  id: string;
  name: string;
  created_at: string;
}

export interface EmployeeUnavailability {
  id: string;
  employee_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  reason: string;
  note: string | null;
  created_at: string;
}

type Table<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      employees: Table<Employee, Partial<Employee> & Pick<Employee, "id" | "full_name" | "username">>;
      shift_presets: Table<ShiftPreset, Partial<ShiftPreset>>;
      schedule_periods: Table<SchedulePeriod, Partial<SchedulePeriod>>;
      shift_instances: Table<ShiftInstance, Partial<ShiftInstance>>;
      availability: Table<Availability, Partial<Availability>>;
      weekly_shift_requests: Table<WeeklyShiftRequest, Partial<WeeklyShiftRequest>>;
      assignments: Table<Assignment, Partial<Assignment>>;
      certifications: Table<CertificationRow, Partial<CertificationRow> & Pick<CertificationRow, "name">>;
      employee_unavailability: Table<
        EmployeeUnavailability,
        Partial<EmployeeUnavailability> & Pick<EmployeeUnavailability, "employee_id" | "start_date" | "end_date" | "reason">
      >;
    };
    Views: Record<string, never>;
    Functions: {
      rename_certification: { Args: { old_name: string; new_name: string }; Returns: undefined };
      delete_certification: { Args: { cert_name: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
