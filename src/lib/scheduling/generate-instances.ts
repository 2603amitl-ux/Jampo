import type { Certification, ShiftPreset } from "@/types/database";

export const PERIOD_LENGTH_DAYS = 7;

// All date math happens in UTC on purpose: start_date/date columns are
// plain "YYYY-MM-DD" values with no time zone, so parsing/formatting in the
// server's local time zone could shift a date by a day near midnight.
export function addDaysUTC(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayOfWeekUTC(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

export function periodEndDate(startDate: string): string {
  return addDaysUTC(startDate, PERIOD_LENGTH_DAYS - 1);
}

export interface GeneratedShiftInstance {
  schedule_period_id: string;
  date: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  required_headcount: number;
  required_certifications: Certification[];
  is_event: boolean;
  event_note: string | null;
}

export function generateShiftInstances(
  presets: ShiftPreset[],
  schedulePeriodId: string,
  startDate: string
): GeneratedShiftInstance[] {
  const rows: GeneratedShiftInstance[] = [];

  for (let i = 0; i < PERIOD_LENGTH_DAYS; i++) {
    const date = addDaysUTC(startDate, i);
    const dow = dayOfWeekUTC(date);

    for (const preset of presets.filter((p) => p.day_of_week === dow)) {
      rows.push({
        schedule_period_id: schedulePeriodId,
        date,
        shift_name: preset.shift_name,
        start_time: preset.start_time,
        end_time: preset.end_time,
        required_headcount: preset.base_headcount,
        required_certifications: preset.required_certifications,
        is_event: false,
        event_note: null,
      });
    }
  }

  return rows;
}
