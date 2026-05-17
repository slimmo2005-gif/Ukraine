/** Week runs Sunday through Saturday (week ends on Saturday). */

export interface SaturdayWeekWindow {
  weekStart: string;
  weekEnd: string;
  periodEnd: string;
  daysIncluded: number;
  isComplete: boolean;
}

export function parseLocalDateKey(dateKey: string): Date {
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(dateKey);
}

export function formatLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Calendar week containing `selectedDate`, ending on the following-or-same Saturday. */
export function getSaturdayWeekWindow(selectedDate: string): SaturdayWeekWindow {
  const d = parseLocalDateKey(selectedDate);
  const dow = d.getDay();
  const daysUntilSaturday = (6 - dow + 7) % 7;
  const weekEndDate = new Date(d);
  weekEndDate.setDate(weekEndDate.getDate() + daysUntilSaturday);
  const weekStartDate = new Date(weekEndDate);
  weekStartDate.setDate(weekStartDate.getDate() - 6);

  const weekStart = formatLocalDateKey(weekStartDate);
  const weekEnd = formatLocalDateKey(weekEndDate);
  const periodEnd = selectedDate <= weekEnd ? selectedDate : weekEnd;

  const start = parseLocalDateKey(weekStart);
  const end = parseLocalDateKey(periodEnd);
  const daysIncluded = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);

  return {
    weekStart,
    weekEnd,
    periodEnd,
    daysIncluded,
    isComplete: periodEnd === weekEnd,
  };
}

export function formatWeekEndingLabel(weekEndKey: string): string {
  const d = parseLocalDateKey(weekEndKey);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}
