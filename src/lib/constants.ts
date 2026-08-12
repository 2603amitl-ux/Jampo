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
