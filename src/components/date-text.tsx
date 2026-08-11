// Displays an ISO "YYYY-MM-DD" date with the year rightmost and the day
// leftmost — the reading order requested for this RTL UI.
//
// CSS `direction`/`dir` alone can't achieve this: a string like
// "2026.08.23" has no strong-direction characters (digits are always
// rendered left-to-right internally per the Unicode bidi algorithm, and
// dots are neutral), so the browser doesn't reorder the year/month/day
// runs no matter what `dir` is set to. Laying them out as separate flex
// items in an RTL container sidesteps text bidi entirely — flexbox
// ordering is deterministic, and each item's own digits are never at risk
// of being reversed since they're rendered in isolation.
export function DateText({ date }: { date: string }) {
  const [year, month, day] = date.split("-");
  return (
    <span className="inline-flex" dir="rtl">
      <span>{year}.</span>
      <span>{month}.</span>
      <span>{day}</span>
    </span>
  );
}
