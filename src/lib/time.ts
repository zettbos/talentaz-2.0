const WIB_TIMEZONE = "Asia/Jakarta";

export interface WibParts {
  workDate: string;
  hhmm: string;
  timeWithSec: string;
  formattedDateTime: string;
  displayDate: string;
  yearMonth: string;
  yyyymmdd: string;
  minutesSinceMidnight: number;
  isoWeekday: number;
}

export function getWibParts(date: Date = new Date()): WibParts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: WIB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  const hourNum = Number(map.hour) % 24;
  const hourStr = String(hourNum).padStart(2, "0");
  const minuteStr = map.minute ?? "00";
  const secondStr = map.second ?? "00";
  const year = map.year ?? "2026";
  const month = map.month ?? "01";
  const day = map.day ?? "01";

  const weekdayLookup: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    workDate: `${year}-${month}-${day}`,
    hhmm: `${hourStr}:${minuteStr}`,
    timeWithSec: `${hourStr}:${minuteStr}:${secondStr}`,
    formattedDateTime: `${day}/${month}/${year} ${hourStr}:${minuteStr}:${secondStr} WIB`,
    displayDate: `${day}/${month}/${year}`,
    yearMonth: `${year}${month}`,
    yyyymmdd: `${year}${month}${day}`,
    minutesSinceMidnight: hourNum * 60 + Number(minuteStr),
    isoWeekday: weekdayLookup[map.weekday ?? "Mon"] ?? 1,
  };
}

export function parseTimeToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 8 * 60;
  return h * 60 + m;
}

export function computeLateStatus(
  clockInMinutes: number,
  workStartTime: string,
  lateGraceMinutes: number
): { isLate: boolean; lateMinutes: number } {
  const startMinutes = parseTimeToMinutes(workStartTime);
  const threshold = startMinutes + Math.max(0, lateGraceMinutes);
  if (clockInMinutes <= threshold) {
    return { isLate: false, lateMinutes: 0 };
  }
  return {
    isLate: true,
    lateMinutes: Math.max(1, clockInMinutes - startMinutes),
  };
}

export function computeDurationMinutes(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (end > start) return end - start;
  // Support overtime shifts crossing midnight.
  return 24 * 60 - start + end;
}

export function getCurrentWeekDaysWib(referenceDate: Date = new Date()): Array<{
  workDate: string;
  labelShort: string;
  dayNumber: string;
}> {
  const current = getWibParts(referenceDate);
  const [y, m, d] = current.workDate.split("-").map(Number);
  const anchorUtc = new Date(Date.UTC(y, m - 1, d, 5, 0, 0));
  const offsetToMonday = current.isoWeekday - 1;
  const labels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  return labels.map((labelShort, index) => {
    const dt = new Date(anchorUtc.getTime() + (index - offsetToMonday) * 86400000);
    const parts = getWibParts(dt);
    return {
      workDate: parts.workDate,
      labelShort,
      dayNumber: parts.workDate.slice(8, 10),
    };
  });
}

export function formatWibTimeShort(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return getWibParts(date).hhmm;
}

export function formatWibDateTimeShort(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  const p = getWibParts(date);
  return `${p.displayDate} ${p.hhmm} WIB`;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMinutesAsHours(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
