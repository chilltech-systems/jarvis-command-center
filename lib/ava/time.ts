export const AVA_TIME_ZONE = "America/Chicago";

export function getCentralHour(date = new Date()) {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: AVA_TIME_ZONE,
  }).formatToParts(date).find((part) => part.type === "hour")?.value;

  return Number(hourPart || "0");
}

export function getCentralGreeting(date = new Date()) {
  const hour = getCentralHour(date);

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatCentralDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: AVA_TIME_ZONE,
  }).format(date);
}

export function formatCentralDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: AVA_TIME_ZONE,
  }).format(date);
}

function centralOffset(date: Date) {
  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone: AVA_TIME_ZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value || "GMT-6";
  const match = offsetName.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) return "-06:00";

  const sign = match[1].startsWith("-") ? "-" : "+";
  const hour = match[1].replace(/[+-]/, "").padStart(2, "0");
  return `${sign}${hour}:${match[2] || "00"}`;
}

function centralMidnightInstant(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  let candidate = new Date(utcMidnight);

  // Resolve the offset at the target local midnight. Iterating avoids the
  // common DST bug where using the noon offset makes spring-forward days 24h.
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const offset = centralOffset(candidate);
    const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
    const minutes = match
      ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))
      : -360;
    const next = new Date(utcMidnight - minutes * 60_000);
    if (next.getTime() === candidate.getTime()) break;
    candidate = next;
  }

  return candidate;
}

export function addCentralDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00${centralOffset(new Date())}`);
  date.setDate(date.getDate() + days);

  return formatCentralDateKey(date);
}

export function getCentralDayWindow(date = new Date()) {
  const sinceDate = formatCentralDateKey(date);
  const untilDate = addCentralDays(sinceDate, 1);

  return {
    since: centralMidnightInstant(sinceDate).toISOString(),
    until: centralMidnightInstant(untilDate).toISOString(),
  };
}

export function formatCentralTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: AVA_TIME_ZONE,
  }).format(date);
}
