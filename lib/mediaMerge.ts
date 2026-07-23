// Interleaves two same-shaped lists (movies + tv shows) by alternating picks, so a
// combined "movies and shows" result set keeps both types visible. On TMDB, tv shows
// carry far fewer votes than movies, so merging by popularity would bury them — the
// single source of truth for that decision lives here and is used by both the
// /discover "all" route and the home recommendation shelves.
export function interleaveMedia<T>(a: T[], b: T[]): T[] {
  const merged: T[] = [];
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    if (a[i]) merged.push(a[i]);
    if (b[i]) merged.push(b[i]);
  }
  return merged;
}
