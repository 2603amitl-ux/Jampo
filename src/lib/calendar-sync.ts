import { parseICS, expandRecurringEvent, type VEvent, type ParameterValue } from "node-ical";
import type { GeneratedShiftInstance } from "./scheduling/generate-instances";

const FETCH_TIMEOUT_MS = 8000;
const IMPORTED_HEADCOUNT_DEFAULT = 1;
const ALL_DAY_START_TIME = "09:00:00";
const ALL_DAY_END_TIME = "17:00:00";

export interface CalendarSyncResult {
  instances: GeneratedShiftInstance[];
  importedCount: number;
  defaultedAllDayCount: number;
  fetchError: string | null; // null = fetch+parse succeeded (0 events found is not an error)
}

function textOf(value: ParameterValue<string> | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.val;
}

// Timed events only — the resolved instant is a real absolute moment, so
// converting it to Israel-local wall-clock time via Intl is safe here.
function formatIsraelLocal(d: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

// All-day events only — node-ical builds these Date objects with the local
// (non-UTC) Date constructor, so they must be read back with local getters,
// never run through the Jerusalem Intl formatter (which would reinterpret
// the instant in a different offset and can shift the date by a day).
function allDayLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function syncCalendarEvents(
  icalUrl: string,
  schedulePeriodId: string,
  rangeStartDate: string, // YYYY-MM-DD inclusive
  rangeEndDate: string // YYYY-MM-DD inclusive
): Promise<CalendarSyncResult> {
  let text: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(icalUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return { instances: [], importedCount: 0, defaultedAllDayCount: 0, fetchError: `היומן החזיר שגיאה (${res.status})` };
    }
    text = await res.text();
  } catch {
    return { instances: [], importedCount: 0, defaultedAllDayCount: 0, fetchError: "לא ניתן היה להתחבר ליומן" };
  }

  let parsed: ReturnType<typeof parseICS>;
  try {
    parsed = parseICS(text);
  } catch {
    return { instances: [], importedCount: 0, defaultedAllDayCount: 0, fetchError: "הקובץ מהיומן לא תקין" };
  }

  // Padded a day on each side of the range for recurrence expansion, since
  // the exact cut is applied afterward using the converted local date.
  const from = new Date(`${rangeStartDate}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(`${rangeEndDate}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 2);

  const instances: GeneratedShiftInstance[] = [];
  let defaultedAllDayCount = 0;

  function add(start: Date, end: Date | undefined, isAllDay: boolean, title: string, description: string | null) {
    const shiftName = title.trim() || "אירוע";
    let date: string;
    let startTime: string;
    let endTime: string;

    if (isAllDay) {
      date = allDayLocalDate(start);
      startTime = ALL_DAY_START_TIME;
      endTime = ALL_DAY_END_TIME;
      defaultedAllDayCount++;
    } else {
      const s = formatIsraelLocal(start);
      const e = formatIsraelLocal(end ?? start);
      date = s.date;
      startTime = `${s.time}:00`;
      // shift_instances has no cross-midnight concept — clamp if the
      // computed end lands on a different local day or isn't after start.
      endTime = e.date === s.date && e.time > s.time ? `${e.time}:00` : "23:59:00";
    }

    if (date < rangeStartDate || date > rangeEndDate) return;

    instances.push({
      schedule_period_id: schedulePeriodId,
      date,
      shift_name: shiftName,
      start_time: startTime,
      end_time: endTime,
      required_headcount: IMPORTED_HEADCOUNT_DEFAULT,
      required_certifications: [],
      is_event: true,
      event_note: description,
    });
  }

  for (const key of Object.keys(parsed)) {
    const component = parsed[key];
    if (!component || component.type !== "VEVENT") continue;
    const vevent = component as VEvent;
    if (vevent.status === "CANCELLED") continue;

    if (vevent.rrule) {
      for (const occurrence of expandRecurringEvent(vevent, { from, to })) {
        if (occurrence.event.status === "CANCELLED") continue;
        add(
          occurrence.start,
          occurrence.end,
          occurrence.isFullDay,
          textOf(occurrence.summary),
          textOf(occurrence.event.description).trim() || null
        );
      }
    } else {
      add(
        vevent.start,
        vevent.end,
        vevent.start?.dateOnly === true || vevent.datetype === "date",
        textOf(vevent.summary),
        textOf(vevent.description).trim() || null
      );
    }
  }

  return { instances, importedCount: instances.length, defaultedAllDayCount, fetchError: null };
}
