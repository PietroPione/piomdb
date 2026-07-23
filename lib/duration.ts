import { t } from "./i18n";
import { formatNumber } from "./format";

// Approximate calendar units — a month is 30 days and a year 365, which is close
// enough for a "how much of my life was this" stat and keeps the phrasing natural.
const UNITS = [
  { key: "year", minutes: 365 * 24 * 60 },
  { key: "month", minutes: 30 * 24 * 60 },
  { key: "day", minutes: 24 * 60 },
  { key: "hour", minutes: 60 },
  { key: "minute", minutes: 1 },
] as const;

/**
 * Turns a raw minute count into readable prose, e.g. "6 mesi, 2 giorni, 13 ore e 15 minuti".
 * Units that come out zero are skipped. Returns an empty string for zero, so callers can
 * drop the line entirely rather than printing a pointless "0 minuti".
 */
export function formatDuration(totalMinutes: number): string {
  let rest = Math.max(0, Math.round(totalMinutes));
  if (rest === 0) return "";

  const parts: string[] = [];
  for (const unit of UNITS) {
    const value = Math.floor(rest / unit.minutes);
    if (value === 0) continue;
    rest -= value * unit.minutes;
    parts.push(`${formatNumber(value)} ${t(`duration.${unit.key}${value === 1 ? "" : "s"}`)}`);
  }

  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} ${t("duration.and")} ${parts[parts.length - 1]}`;
}
