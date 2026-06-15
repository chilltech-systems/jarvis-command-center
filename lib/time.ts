export const CENTRAL_TIME_ZONE = "America/Chicago";

const centralTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CENTRAL_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

export function formatCentralTime(value?: string | null) {
  if (!value) return "No timestamp";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid timestamp" : centralTimeFormatter.format(date);
}

export function timeAgo(value?: string | null) {
  if (!value) return "No signal";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid timestamp";

  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(minutes) < 60) return formatter.format(minutes || -1, "minute");

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");

  return formatter.format(Math.round(hours / 24), "day");
}

export function formatCentralSignal(value?: string | null) {
  if (!value) return "No signal";
  return `${timeAgo(value)} · ${formatCentralTime(value)}`;
}
