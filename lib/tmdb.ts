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
  keywords?: { id: number; name: string }[];
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
    // Keywords piggyback on the same request as credits — no extra TMDB call needed
    // to feed the taste profile's theme signal.
    const payload = await fetchFromTMDB(`/${type}/${id}`, { append_to_response: "credits,keywords" });

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

    // Movie and tv keyword sub-responses wrap the same shape under different keys.
    const keywords = ((payload.keywords?.keywords || payload.keywords?.results || []) as any[]).map((k: any) => ({
      id: k.id,
      name: k.name,
    }));

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
      keywords,
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

export interface TmdbTag {
  id: number;
  name: string;
}

export async function getGenreList(type: "movie" | "tv"): Promise<TmdbTag[]> {
  try {
    const payload = await fetchFromTMDB(`/genre/${type}/list`);
    return (payload.genres || []) as TmdbTag[];
  } catch (error) {
    console.error("TMDB genre list failed:", error);
    return [];
  }
}

export async function searchKeyword(query: string): Promise<TmdbTag[]> {
  if (!query.trim()) return [];
  try {
    const payload = await fetchFromTMDB("/search/keyword", { query });
    return (payload.results || []) as TmdbTag[];
  } catch (error) {
    console.error("TMDB keyword search failed:", error);
    return [];
  }
}

export interface PersonResult extends TmdbTag {
  profile_path: string | null;
  known_for_department: string;
}

export async function searchPerson(query: string): Promise<PersonResult[]> {
  if (!query.trim()) return [];
  try {
    const payload = await fetchFromTMDB("/search/person", { query });
    return ((payload.results || []) as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      profile_path: p.profile_path ? `${TMDB_POSTER_URL}${p.profile_path}` : null,
      known_for_department: p.known_for_department || "",
    }));
  } catch (error) {
    console.error("TMDB person search failed:", error);
    return [];
  }
}

/** A title a person worked on, tagged with the role they had on it. */
export interface PersonCredit extends MediaItem {
  role: string; // crew job ("Director", "Writer", …) or "Acting" for cast credits
  department: string;
}

export interface PersonDetail {
  id: string;
  name: string;
  profile_path: string | null;
  biography: string;
  known_for_department: string;
  credits: PersonCredit[];
}

/**
 * A person plus their full filmography. Cast and crew credits are returned as one
 * list, each tagged with its role, so the UI can filter by "Director"/"Writer"/etc.
 * A person credited twice on the same title (e.g. wrote and directed it) yields one
 * entry per role — callers dedupe when showing an unfiltered list.
 */
export async function getPersonWithCredits(id: string | number): Promise<PersonDetail | null> {
  try {
    const payload = await fetchFromTMDB(`/person/${id}`, { append_to_response: "combined_credits" });
    if (!payload?.id) return null;

    const toCredit = (item: any, role: string, department: string): PersonCredit => ({
      ...mapTmdbToMedia(item, item.media_type === "tv" ? "tv" : "movie"),
      role,
      department,
    });

    const isShowable = (c: any) => c.media_type === "movie" || c.media_type === "tv";

    const cast = ((payload.combined_credits?.cast || []) as any[])
      .filter(isShowable)
      .map((c) => toCredit(c, "Acting", "Acting"));
    const crew = ((payload.combined_credits?.crew || []) as any[])
      .filter(isShowable)
      .map((c) => toCredit(c, c.job || "Crew", c.department || "Crew"));

    // Newest first — a filmography reads better in reverse-chronological order.
    const credits = [...cast, ...crew].sort((a, b) => (b.release_date || "").localeCompare(a.release_date || ""));

    return {
      id: String(payload.id),
      name: payload.name || "",
      profile_path: payload.profile_path ? `${TMDB_POSTER_URL}${payload.profile_path}` : null,
      biography: payload.biography || "",
      known_for_department: payload.known_for_department || "",
      credits,
    };
  } catch (error) {
    console.error("TMDB person fetch failed:", error);
    return null;
  }
}

export interface DiscoverOptions {
  genreIds?: number[];
  keywordIds?: number[];
  castIds?: number[];
  crewIds?: number[];
  sortBy?: string;
  minVoteAverage?: number;
  minVoteCount?: number;
  page?: number;
}

export interface DiscoverResult {
  results: MediaItem[];
  totalResults: number;
}

// Multiple ids for the same filter are joined with "," (AND) — picking several
// genre/keyword/person chips narrows results down to titles matching all of them.
export async function discoverMedia(type: "movie" | "tv", options: DiscoverOptions = {}): Promise<DiscoverResult> {
  const params: Record<string, string> = {
    sort_by: options.sortBy || "popularity.desc",
    "vote_count.gte": String(options.minVoteCount ?? 50),
  };
  if (options.genreIds?.length) params.with_genres = options.genreIds.join(",");
  if (options.keywordIds?.length) params.with_keywords = options.keywordIds.join(",");
  if (options.castIds?.length) params.with_cast = options.castIds.join(",");
  if (options.crewIds?.length) params.with_crew = options.crewIds.join(",");
  if (options.minVoteAverage) params["vote_average.gte"] = String(options.minVoteAverage);
  if (options.page) params.page = String(options.page);

  try {
    const payload = await fetchFromTMDB(`/discover/${type}`, params);
    return {
      results: ((payload.results || []) as any[]).map((item) => mapTmdbToMedia(item, type)),
      totalResults: payload.total_results || 0,
    };
  } catch (error) {
    console.error("TMDB discover failed:", error);
    return { results: [], totalResults: 0 };
  }
}
