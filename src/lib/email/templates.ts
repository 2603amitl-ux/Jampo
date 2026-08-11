function wrap(bodyHtml: string): string {
  return `<div dir="rtl" style="font-family:sans-serif;color:#1f2937;max-width:480px;margin:0 auto">
    <h2 style="color:#c2410c">ג'אמפו</h2>
    ${bodyHtml}
  </div>`;
}

export function availabilityReminderEmail(params: {
  fullName: string;
  periodStart: string;
  periodEnd: string;
  siteUrl: string;
}) {
  const { fullName, periodStart, periodEnd, siteUrl } = params;
  return {
    subject: `תזכורת: מילוי זמינות למחזור ${periodStart} – ${periodEnd}`,
    html: wrap(`
      <p>היי ${fullName},</p>
      <p>נפתח מחזור שיבוץ חדש (${periodStart} עד ${periodEnd}). אנא היכנס/י ומלא/י את הזמינות שלך בהקדם.</p>
      <p><a href="${siteUrl}/availability" style="color:#ea580c">למילוי זמינות</a></p>
    `),
  };
}

export function scheduleAssignmentEmail(params: {
  fullName: string;
  periodStart: string;
  periodEnd: string;
  shifts: { date: string; shiftName: string; startTime: string; endTime: string }[];
  siteUrl: string;
}) {
  const { fullName, periodStart, periodEnd, shifts, siteUrl } = params;
  const rows = shifts
    .map(
      (s) =>
        `<tr><td style="padding:4px 8px">${s.date}</td><td style="padding:4px 8px">${s.shiftName}</td><td style="padding:4px 8px">${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}</td></tr>`
    )
    .join("");

  return {
    subject: `השיבוץ שלך למחזור ${periodStart} – ${periodEnd}`,
    html: wrap(`
      <p>היי ${fullName},</p>
      <p>השיבוץ שלך למחזור ${periodStart} עד ${periodEnd} פורסם:</p>
      <table style="border-collapse:collapse;width:100%">${rows}</table>
      <p style="margin-top:16px"><a href="${siteUrl}/my-schedule" style="color:#ea580c">לצפייה בשיבוץ המלא</a></p>
    `),
  };
}
