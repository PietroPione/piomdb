/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Star, Clock, TrendingUp, Sparkles, Tag, Film, Shuffle } from "lucide-react";
import { getCurrentUser, getTrackedMedia, TrackedMedia } from "@/lib/db";
import { cachedFetch } from "@/lib/apiCache";
import { interleaveMedia } from "@/lib/mediaMerge";
import { t } from "@/lib/i18n";
import { scrollBelowNavbar } from "@/lib/scroll";

const PAGE_SIZE = 20; // TMDB returns 20 results per discover page
const TMDB_MAX_PAGE = 500; // TMDB refuses pages beyond this

function dedupeById(items: any[]) {
  const seen = new Set<string>();
  return items.filter((m) => {
    const key = `${m.media_type}-${m.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Drops titles the user already tracks, dedupes, and caps the shelf at 10 — preserving
// whatever order it was handed (TMDB's popularity ranking normally, shuffled when the
// user asked for random picks).
function trimShelf(items: any[], excludeIds: Set<string>) {
  return dedupeById(items.filter((m) => !excludeIds.has(`${m.media_type}-${m.id}`))).slice(0, 10);
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Genre/keyword discover results are effectively static, so cache them client-side —
// the home shelves fetch several at once and this makes repeat visits free.
async function fetchDiscover(
  type: "movie" | "tv",
  opts: { genres?: number[]; keywords?: number[]; page?: number }
): Promise<{ results: any[]; totalResults: number }> {
  const params = new URLSearchParams({ type });
  if (opts.genres?.length) params.set("genres", opts.genres.join(","));
  if (opts.keywords?.length) params.set("keywords", opts.keywords.join(","));
  if (opts.page) params.set("page", String(opts.page));
  const qs = params.toString();
  // -v2: this entry used to cache a bare results array. Bumping the key retires those
  // stale entries instead of handing callers an object without `.results`.
  return cachedFetch(`home-discover-v2-${qs}`, async () => {
    const res = await fetch(`/api/tmdb/discover?${qs}`);
    const data = await res.json();
    return { results: (data.results || []) as any[], totalResults: (data.totalResults || 0) as number };
  });
}

type ShelfQuery =
  | { kind: "genre"; mediaType: "movie" | "tv"; id: number }
  | { kind: "theme"; id: number };

interface Shelf {
  key: string;
  label: string;
  query: ShelfQuery;
  items: any[];
  totalPages: number;
}

const pagesFor = (totalResults: number) => Math.min(Math.ceil(totalResults / PAGE_SIZE), TMDB_MAX_PAGE);

// One shelf's worth of results. A genre belongs to a single media type; a theme applies
// to movies and shows alike, so it queries both and interleaves them.
async function loadShelf(query: ShelfQuery, page?: number): Promise<{ results: any[]; totalPages: number }> {
  if (query.kind === "genre") {
    const { results, totalResults } = await fetchDiscover(query.mediaType, { genres: [query.id], page });
    return { results, totalPages: pagesFor(totalResults) };
  }
  const [movies, shows] = await Promise.all([
    fetchDiscover("movie", { keywords: [query.id], page }),
    fetchDiscover("tv", { keywords: [query.id], page }),
  ]);
  return {
    results: interleaveMedia(movies.results, shows.results),
    totalPages: Math.max(pagesFor(movies.totalResults), pagesFor(shows.totalResults)),
  };
}

function RecommendationCard({ media }: { media: any }) {
  return (
    <Link
      href={`/media/${media.media_type}/${media.id}`}
      className="group relative flex flex-col bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
    >
      <div className="relative aspect-2/3 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <Image
          src={media.poster_path}
          alt={media.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          unoptimized
        />
        <div className="absolute top-2 right-2 bg-yellow-600 text-white font-bold text-xxs px-2 py-0.5 rounded shadow">
          {t(`mediaType.${media.media_type}`).toUpperCase()}
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col justify-between">
        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 line-clamp-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
          {media.title}
        </h3>
      </div>
    </Link>
  );
}

// A recommendation shelf whose heading is a dropdown, letting the user switch which
// facet (theme / genre) drives the row below. Shared by the theme and genre shelves.
function RecommendationDropdown({
  icon: Icon,
  shelves,
  selectedIdx,
  onSelect,
  onRandom,
  randomizing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  shelves: Shelf[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
  onRandom: () => void;
  randomizing: boolean;
}) {
  if (shelves.length === 0) return null;
  const items = shelves[selectedIdx]?.items || [];
  return (
    <div className="mb-10 last:mb-0">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <select
            value={selectedIdx}
            onChange={(e) => onSelect(Number(e.target.value))}
            className="text-base font-bold tracking-tight text-zinc-700 dark:text-zinc-300 bg-transparent focus:outline-none cursor-pointer"
          >
            {shelves.map((s, idx) => (
              <option key={s.key} value={idx}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={onRandom}
          disabled={randomizing}
          className="inline-flex items-center gap-1 text-xs font-bold text-yellow-600 dark:text-yellow-400 hover:underline disabled:opacity-50"
        >
          <Shuffle className={`h-3.5 w-3.5 ${randomizing ? "animate-spin" : ""}`} />
          {t("home.showRandom")}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {items.map((media) => (
          <RecommendationCard key={`${media.media_type}-${media.id}`} media={media} />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [results, setResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [genreShelves, setGenreShelves] = useState<Shelf[]>([]);
  const [selectedGenreIdx, setSelectedGenreIdx] = useState(0);
  const [themeShelves, setThemeShelves] = useState<Shelf[]>([]);
  const [selectedThemeIdx, setSelectedThemeIdx] = useState(0);
  const [randomizingKey, setRandomizingKey] = useState<string | null>(null);
  const trackedIdsRef = useRef<Set<string>>(new Set());

  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<"all" | "movie" | "tv">("all");
  const [isPending, startTransition] = useTransition();
  const searchEndRef = useRef<HTMLDivElement>(null);

  // Hidden/Private mock activity feed for friends
  const [showFriendsActivity] = useState(false); // Flag configured as false to keep section hidden as requested
  const mockFriendsActivity = [
    { name: "John", action: "watched", title: "Inception", type: "movie", time: "10m ago" },
    { name: "Sarah", action: "added to watchlist", title: "Breaking Bad", type: "tv", time: "1h ago" },
    { name: "David", action: "rated 10/10", title: "Interstellar", type: "movie", time: "3h ago" }
  ];

  useEffect(() => {
    // Builds a taste profile from the user's own tracked titles (genres/cast/director/
    // keywords saved at track time) and turns it into up to four /discover-backed rows —
    // no TMDB "black box" recommendation endpoint involved, so every row is explainable.
    async function computeRecommendations(tracked: TrackedMedia[]) {
      const liked = tracked.filter(
        (i) => i.status === "Watched" || i.is_favorite || (i.user_rating ?? 0) >= 8
      );
      if (liked.length === 0) return;

      const trackedIds = new Set(tracked.map((i) => `${i.media_type}-${i.media_id}`));
      trackedIdsRef.current = trackedIds;

      const movieGenreFreq = new Map<number, { name: string; count: number }>();
      const showGenreFreq = new Map<number, { name: string; count: number }>();
      const keywordFreq = new Map<number, { name: string; count: number }>();

      liked.forEach((item) => {
        const genreMap = item.media_type === "movie" ? movieGenreFreq : showGenreFreq;
        (item.genres || []).forEach((g) => {
          const entry = genreMap.get(g.id) || { name: g.name, count: 0 };
          entry.count++;
          genreMap.set(g.id, entry);
        });
        (item.keywords || []).forEach((k) => {
          const entry = keywordFreq.get(k.id) || { name: k.name, count: 0 };
          entry.count++;
          keywordFreq.set(k.id, entry);
        });
      });

      // Top 5 genres across both media types, ranked by how often they show up in liked
      // titles — kept as separate movie/tv entries since the same name can mean a
      // different TMDB genre id (or not exist at all) per type.
      const genreEntries = [
        ...[...movieGenreFreq.entries()].map(([id, v]) => ({ id, name: v.name, mediaType: "movie" as const, count: v.count })),
        ...[...showGenreFreq.entries()].map(([id, v]) => ({ id, name: v.name, mediaType: "tv" as const, count: v.count })),
      ]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top 5 themes (keywords appearing in at least 2 liked titles) — same dropdown
      // treatment as genres, so the user can pick which theme's row to see.
      const keywordEntries = [...keywordFreq.entries()]
        .filter(([, v]) => v.count >= 2)
        .map(([id, v]) => ({ id, name: v.name, count: v.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const genreDefs = genreEntries.map((g) => ({
        key: `${g.mediaType}-${g.id}`,
        label: g.name,
        query: { kind: "genre", mediaType: g.mediaType, id: g.id } as ShelfQuery,
      }));
      const themeDefs = keywordEntries.map((k) => ({
        key: String(k.id),
        label: k.name,
        query: { kind: "theme", id: k.id } as ShelfQuery,
      }));

      const [genreLoaded, themeLoaded] = await Promise.all([
        Promise.all(genreDefs.map((d) => loadShelf(d.query))),
        Promise.all(themeDefs.map((d) => loadShelf(d.query))),
      ]);

      const toShelves = (defs: typeof genreDefs, loaded: { results: any[]; totalPages: number }[]): Shelf[] =>
        defs.map((d, i) => ({
          ...d,
          items: trimShelf(loaded[i].results, trackedIds),
          totalPages: loaded[i].totalPages,
        }));

      setGenreShelves(toShelves(genreDefs, genreLoaded));
      setSelectedGenreIdx(0);
      setThemeShelves(toShelves(themeDefs, themeLoaded));
      setSelectedThemeIdx(0);
    }

    async function loadDashboardData() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        if (currentUser) {
          const tracked = await getTrackedMedia(currentUser.id);
          computeRecommendations(tracked);
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      }
    }

    loadDashboardData();
  }, []);

  // "Mostrami titoli casuali" — the default shelf is TMDB's popularity ranking, which
  // surfaces exactly the titles the user is most likely to already know. This pulls a
  // random page from the same category and shuffles it, so the shelf digs into the long
  // tail instead of the front page.
  const randomizeShelf = async (kind: "genre" | "theme") => {
    const shelves = kind === "genre" ? genreShelves : themeShelves;
    const idx = kind === "genre" ? selectedGenreIdx : selectedThemeIdx;
    const setShelves = kind === "genre" ? setGenreShelves : setThemeShelves;
    const shelf = shelves[idx];
    if (!shelf) return;

    setRandomizingKey(shelf.key);
    try {
      const page = 1 + Math.floor(Math.random() * Math.max(1, shelf.totalPages));
      let { results } = await loadShelf(shelf.query, page);
      // Deep pages can come back empty (TMDB's advertised totals overshoot what it
      // actually serves), so fall back to the first page rather than blanking the shelf.
      if (results.length === 0) ({ results } = await loadShelf(shelf.query, 1));

      const items = trimShelf(shuffle(results), trackedIdsRef.current);
      if (items.length > 0) {
        setShelves((prev) => prev.map((s, i) => (i === idx ? { ...s, items } : s)));
      }
    } catch (error) {
      console.error("Failed to load random titles:", error);
    } finally {
      setRandomizingKey(null);
    }
  };

  // Load trending whenever the type filter changes, as long as there's no active search query
  useEffect(() => {
    async function fetchTrending() {
      try {
        setResultsLoading(true);
        const res = await fetch(`/api/tmdb/trending?type=${mediaType}`);
        const data = await res.json();
        if (data.results) {
          setResults(data.results.slice(0, 8));
        }
      } catch (error) {
        console.error("Failed to load trending:", error);
      } finally {
        setResultsLoading(false);
      }
    }

    if (!query) {
      fetchTrending();
    }
  }, [mediaType, query]);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (!val) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(val)}&type=${mediaType}`);
        const data = await res.json();
        if (data.results) {
          setResults(data.results);
        }
      } catch (error) {
        console.error("Search error:", error);
      }
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur(); // dismiss the mobile keyboard
      scrollBelowNavbar(searchEndRef.current);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Compact Hero: search is the primary action here, not a marketing banner */}
      <section className="relative overflow-hidden bg-linear-to-br from-yellow-900 via-yellow-950 to-zinc-950 text-white py-14 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.25),rgba(255,255,255,0))]" />

        <div className="max-w-2xl mx-auto relative z-10 text-center space-y-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
            <Sparkles className="h-3.5 w-3.5" />
            {t("home.welcome")}
          </span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            {t("home.heroTitle")}{" "}
            <span className="bg-linear-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-transparent">
              {t("home.heroSubtitle")}
            </span>
          </h1>

          {/* Search bar, front and center */}
          <div className="pt-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-zinc-400" />
              </div>
              <input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t("discover.searchPlaceholder")}
                className="block w-full pl-12 pr-4 py-4 rounded-2xl bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/40 shadow-lg text-base"
              />
              {isPending && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-yellow-600 border-t-transparent" />
                </div>
              )}
            </div>

            <div className="flex justify-center gap-2 mt-3">
              {(["all", "movie", "tv"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setMediaType(type)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    mediaType === type
                      ? "bg-yellow-600 text-white"
                      : "bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900/80 border border-zinc-800"
                  }`}
                >
                  {type === "all" ? t("discover.all") : type === "movie" ? t("discover.movies") : t("discover.tvShows")}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div ref={searchEndRef} />
      </section>

      {/* Consigliati per te - personalized, explainable recommendations built from the
          user's own taste profile (tracked titles' genres/cast/director/keywords).
          Tracked/watched items themselves live only in the Watchlist page, not here. */}
      {user && !query && (themeShelves.length > 0 || genreShelves.length > 0) && (
        <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-12">
          <div className="flex items-center gap-2 mb-8">
            <Sparkles className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-2xl font-bold tracking-tight">{t("home.recommendedForYou")}</h2>
          </div>
          <RecommendationDropdown
            icon={Tag}
            shelves={themeShelves}
            selectedIdx={selectedThemeIdx}
            onSelect={setSelectedThemeIdx}
            onRandom={() => randomizeShelf("theme")}
            randomizing={randomizingKey === themeShelves[selectedThemeIdx]?.key}
          />
          <RecommendationDropdown
            icon={Film}
            shelves={genreShelves}
            selectedIdx={selectedGenreIdx}
            onSelect={setSelectedGenreIdx}
            onRandom={() => randomizeShelf("genre")}
            randomizing={randomizingKey === genreShelves[selectedGenreIdx]?.key}
          />
        </section>
      )}

      {/* Results: search results when there's a query, trending otherwise */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-12 flex-1">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-2xl font-bold tracking-tight">
              {query ? t("discover.searchResultsFor", { query }) : t("home.trendingThisWeek")}
            </h2>
          </div>
          {!query && (
            <Link
              href="/discover"
              className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 hover:underline"
            >
              {t("home.exploreAll")}
            </Link>
          )}
        </div>

        {resultsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-yellow-600 border-t-transparent" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-zinc-900/40 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8">
            <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-200">{t("discover.noTitlesFound")}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mt-1">
              {t("discover.noTitlesHint")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
            {results.map((media) => (
              <Link
                key={`${media.media_type}-${media.id}`}
                href={`/media/${media.media_type}/${media.id}`}
                className="group flex flex-col bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1"
              >
                <div className="relative aspect-2/3 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  <Image
                    src={media.poster_path}
                    alt={media.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    unoptimized
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className="bg-zinc-950/80 backdrop-blur-md text-white font-bold text-xxs px-2 py-0.5 rounded shadow">
                      {t(`mediaType.${media.media_type}`).toUpperCase()}
                    </span>
                  </div>
                  {media.vote_average > 0 && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-zinc-950/80 backdrop-blur-sm text-yellow-400 text-xs font-bold px-2 py-0.5 rounded">
                      <Star className="h-3 w-3 fill-current" />
                      {media.vote_average.toFixed(1)}
                    </div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 line-clamp-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                      {media.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1.5">
                      {media.overview}
                    </p>
                  </div>
                  {media.release_date && (
                    <div className="text-xxs text-zinc-400 font-semibold mt-3">
                      {(() => {
                        const raw = String(media.release_date || "");
                        const year = raw.match(/\d{4}/)?.[0];
                        return year || "";
                      })()}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Friends Activity Feed Section (Hidden/Configurable) */}
      {showFriendsActivity && (
        <section className="bg-zinc-100 dark:bg-zinc-900/40 border-t border-zinc-200 dark:border-zinc-800 py-12 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              What your friends are watching
            </h2>
            <div className="space-y-3">
              {mockFriendsActivity.map((activity, i) => (
                <div key={i} className="flex justify-between items-center bg-white dark:bg-zinc-900 p-3 rounded-lg shadow-sm border border-zinc-100 dark:border-zinc-800">
                  <div className="text-sm font-medium">
                    <span className="font-bold text-yellow-600 dark:text-yellow-400">{activity.name}</span>{" "}
                    <span className="text-zinc-500">{activity.action}</span>{" "}
                    <span className="font-semibold">{activity.title}</span>{" "}
                    <span className="text-xxs uppercase tracking-wider text-zinc-400 font-bold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                      {activity.type}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
