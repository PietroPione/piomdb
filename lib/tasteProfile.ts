// Distils the taste-profile signals (genres + themes/keywords) from a TMDB detail
// payload. Shared by the media detail page and the TV Time importer so the
// extraction rules (which fields, the top-5 keyword cap) live in exactly one place.
// Kept free of server-only imports so client components can use it directly.

export interface TasteProfile {
  genres: { id: number; name: string }[] | null;
  keywords: { id: number; name: string }[] | null;
}

export function extractTasteProfile(detail: {
  genres?: { id: number; name: string }[];
  keywords?: { id: number; name: string }[];
} | null | undefined): TasteProfile {
  return {
    genres: detail?.genres?.length ? detail.genres.map((g) => ({ id: g.id, name: g.name })) : null,
    keywords: detail?.keywords?.length ? detail.keywords.slice(0, 5).map((k) => ({ id: k.id, name: k.name })) : null,
  };
}
