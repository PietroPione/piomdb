import it from "@/locales/it.json";

type Translations = typeof it;

/**
 * Looks up a dot-notation key in locales/it.json, e.g. t("nav.discover").
 * Returns the key itself if missing, so a typo shows up as visible broken
 * text instead of a silent blank — easier to spot during development.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = it as Translations;

  for (const part of parts) {
    if (node && typeof node === "object" && part in node) {
      node = node[part];
    } else {
      return key;
    }
  }

  if (typeof node !== "string") return key;

  if (!vars) return node;
  return Object.entries(vars).reduce(
    (str, [varKey, value]) => str.replaceAll(`{{${varKey}}}`, String(value)),
    node
  );
}
