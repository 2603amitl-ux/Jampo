import type { PeriodStatus } from "@/types/database";

export const DAY_NAMES = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
];

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  draft: "טיוטה",
  collecting: "איסוף זמינות",
  generated: "שובץ (טרם פורסם)",
  published: "פורסם",
};

export const UNAVAILABILITY_REASONS = ["חופשה / חו\"ל", "רפואי", "אחר"];

// An employee is "in training" until they hold this certification — no
// separate status field: it's derived purely from whether "כללי" is in
// their certifications list. If this certification is ever renamed, this
// constant needs to be updated to match.
export const BASE_CERTIFICATION = "כללי";

export function isTrained(employee: { certifications: string[] }): boolean {
  return employee.certifications.includes(BASE_CERTIFICATION);
}
