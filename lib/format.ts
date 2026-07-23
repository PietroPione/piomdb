/**
 * Formats a number with Italian thousands separators, forcing grouping on 4-digit
 * numbers too. Italian CLDR sets minimumGroupingDigits=2, so `it-IT` renders 2812
 * bare but 19248 as "19.248" — fine in prose, jarring when figures sit side by side
 * in a stats row, so we group consistently everywhere.
 */
export function formatNumber(value: number): string {
  return value.toLocaleString("it-IT", { useGrouping: "always" });
}
