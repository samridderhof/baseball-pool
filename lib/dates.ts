const EASTERN_TIMEZONE = "America/New_York";

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

function getZonedParts(reference: Date, timeZone = EASTERN_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(reference);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    weekday: weekdayMap[lookup.weekday],
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day)
  };
}

export function getCurrentDateKey(reference = new Date()) {
  const zoned = getZonedParts(reference);
  return `${zoned.year.toString().padStart(4, "0")}-${zoned.month
    .toString()
    .padStart(2, "0")}-${zoned.day.toString().padStart(2, "0")}`;
}

export function formatEasternDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }
) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIMEZONE,
    ...options
  }).format(date);
}

function makeUtcNoonDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function getActiveSaturday(reference = new Date()) {
  const zoned = getZonedParts(reference);
  const normalized = makeUtcNoonDate(zoned.year, zoned.month, zoned.day);
  const daysUntilSaturday = (6 - zoned.weekday + 7) % 7;
  return addUtcDays(normalized, daysUntilSaturday);
}

export function getPreviousSaturday(reference = new Date()) {
  const zoned = getZonedParts(reference);
  const normalized = makeUtcNoonDate(zoned.year, zoned.month, zoned.day);
  const daysSinceSaturday = (zoned.weekday - 6 + 7) % 7;
  return addUtcDays(normalized, -daysSinceSaturday);
}

export function saturdayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseSaturdayKey(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}
