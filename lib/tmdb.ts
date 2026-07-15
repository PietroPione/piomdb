/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRateLimiter, TMDB_RATE_PER_SECOND } from "./rateLimit";

const TMDB_API_URL = "https://api.themoviedb.org/3";
const TMDB_READ_ACCESS_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN || "";
const TMDB_POSTER_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_URL = "https://image.tmdb.org/t/p/w1280";
const FALLBACK_POSTER = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=400&auto=format&fit=crop";

// TMDB's documented burst limit is ~50 req/s; stay a safe margin under it so a
// bulk import never trips a 429, no matter how many requests are queued.
const acquireSlot = createRateLimiter(TMDB_RATE_PER_SECOND);

type MediaType = "movie" | "tv" | "all";

export interface MediaItem {
  id: string;
  title: string;
  media_type: "movie" | "tv";
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  runtime?: number | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  status?: string;
  tagline?: string;
  credits?: {
    cast: { id: number; name: string; character: string; profile_path: string | null }[];
    crew: { id: number; name: string; job: string; department: string }[];
  };
}

export interface SeasonEpisode {
  episode: number;
  title: string;
  released: string;
  vote_average: number;
  runtime: number | null;
}

async function fetchFromTMDB(path: string, params: Record<string, string> = {}) {
  await acquireSlot();

  const queryParams = new URLSearchParams(params);
  const response = await fetch(`${TMDB_API_URL}${path}?${queryParams.toString()}`, {
    headers: { Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}` },
  });

  if (!response.ok) {
    throw new Error(`TMDB fetch failed: ${response.statusText}`);
  }

  return response.json();
}

function posterUrl(path: string | null | undefined) {
  return path ? `${TMDB_POSTER_URL}${path}` : FALLBACK_POSTER;
}

function backdropUrl(path: string | null | undefined) {
  return path ? `${TMDB_BACKDROP_URL}${path}` : FALLBACK_POSTER;
}

function mapTmdbToMedia(item: any, fallbackType: "movie" | "tv"): MediaItem {
  const mediaType = (item.media_type === "movie" || item.media_type === "tv" ? item.media_type : fallbackType) as "movie" | "tv";

  return {
    id: String(item.id),
    title: item.title || item.name || "Untitled",
    media_type: mediaType,
    overview: item.overview || "",
    poster_path: posterUrl(item.poster_path),
    backdrop_path: backdropUrl(item.backdrop_path),
    release_date: item.release_date || item.first_air_date || "",
    vote_average: item.vote_average || 0,
    vote_count: item.vote_count || 0,
    genres: [],
  };
}

export async function searchMedia(query: string, type: MediaType = "all") {
  if (!query.trim()) {
    return [];
  }

  try {
    if (type === "all") {
      const payload = await fetchFromTMDB("/search/multi", { query });
      return ((payload.results || []) as any[])
        .filter((item) => item.media_type === "movie" || item.media_type === "tv")
        .map((item) => mapTmdbToMedia(item, item.media_type));
    }

    const payload = await fetchFromTMDB(`/search/${type === "movie" ? "movie" : "tv"}`, { query });
    return ((payload.results || []) as any[]).map((item) => mapTmdbToMedia(item, type as "movie" | "tv"));
  } catch (error) {
    console.error("TMDB search failed:", error);
    return [];
  }
}

export async function getTrendingMedia(type: MediaType = "all") {
  try {
    const payload = await fetchFromTMDB(`/trending/${type}/week`);
    return ((payload.results || []) as any[])
      .filter((item) => item.media_type === "movie" || item.media_type === "tv")
      .slice(0, 8)
      .map((item) => mapTmdbToMedia(item, item.media_type));
  } catch (error) {
    console.error("TMDB trending failed:", error);
    return [];
  }
}

/**
 * Resolves a show/movie title (e.g. from an imported watch-history CSV) to its
 * TMDB id + poster. Retries once with a trailing "(...)" disambiguator (e.g.
 * "The Office (US)") stripped, since TMDB's title search won't match those.
 */
export async function resolveShowByTitle(title: string, type: "movie" | "tv" = "tv"): Promise<{ id: string; poster: string } | null> {
  const tryFetch = async (t: string) => {
    try {
      const payload = await fetchFromTMDB(`/search/${type === "movie" ? "movie" : "tv"}`, { query: t });
      const match = (payload.results || [])[0];
      if (!match) return null;
      return { id: String(match.id), poster: posterUrl(match.poster_path) };
    } catch {
      return null;
    }
  };

  const direct = await tryFetch(title);
  if (direct) return direct;

  const stripped = title.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (stripped && stripped !== title) {
    return tryFetch(stripped);
  }

  return null;
}

export async function getMediaDetail(type: "movie" | "tv", id: string | number) {
  try {
    const payload = await fetchFromTMDB(`/${type}/${id}`, { append_to_response: "credits" });

    const cast = (payload.credits?.cast || []).slice(0, 15).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character || "",
      profile_path: c.profile_path ? `${TMDB_POSTER_URL}${c.profile_path}` : null,
    }));

    const crew = (payload.credits?.crew || [])
      .filter((c: any) => ["Director", "Writer", "Screenplay", "Creator"].includes(c.job) || c.department === "Writing")
      .slice(0, 8)
      .map((c: any) => ({ id: c.id, name: c.name, job: c.job, department: c.department }));

    return {
      id: String(payload.id),
      title: payload.title || payload.name || "",
      media_type: type,
      overview: payload.overview || "",
      poster_path: posterUrl(payload.poster_path),
      backdrop_path: backdropUrl(payload.backdrop_path),
      release_date: payload.release_date || payload.first_air_date || "",
      vote_average: payload.vote_average || 0,
      vote_count: payload.vote_count || 0,
      genres: payload.genres || [],
      runtime: type === "movie" ? payload.runtime || null : null,
      number_of_seasons: type === "tv" ? payload.number_of_seasons || null : null,
      number_of_episodes: type === "tv" ? payload.number_of_episodes || null : null,
      status: payload.status || "Unknown",
      tagline: payload.tagline || "",
      credits: { cast, crew },
    } satisfies MediaItem;
  } catch (error) {
    console.error("TMDB detail failed:", error);
    return null;
  }
}

export async function getSeasonEpisodes(id: string, season: number): Promise<SeasonEpisode[]> {
  try {
    const payload = await fetchFromTMDB(`/tv/${id}/season/${season}`);
    const episodes = (payload.episodes || []) as any[];

    return episodes.map((ep) => ({
      episode: ep.episode_number,
      title: ep.name || `Episode ${ep.episode_number}`,
      released: ep.air_date || "",
      vote_average: ep.vote_average || 0,
      runtime: ep.runtime ?? null,
    }));
  } catch (error) {
    console.error("TMDB season fetch failed:", error);
    return [];
  }
}
