/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Film, SlidersHorizontal, Star, X, ChevronDown } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatNumber } from "@/lib/format";
import { scrollBelowNavbar } from "@/lib/scroll";

interface Tag {
  id: number;
  name: string;
}

// A typeahead fetcher against a TMDB search endpoint that returns { results: {id,name}[] }.
// Shared by the keyword and person (actor/director) pickers.
function fetchTags(endpoint: string) {
  return async (q: string): Promise<Tag[]> => {
    const res = await fetch(`${endpoint}?query=${encodeURIComponent(q)}`);
    const data = await res.json();
    return data.results || [];
  };
}

/** Debounced search-as-you-type against a TMDB search endpoint (keyword/person). */
function useTypeahead<T>(fetcher: (query: string) => Promise<T[]>) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<T[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      fetcher(query).then(setSuggestions).catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  return { query, setQuery, suggestions, setSuggestions };
}

const SORT_OPTIONS = [
  { value: "popularity.desc", labelKey: "discover.sortPopularity" },
  { value: "vote_average.desc", labelKey: "discover.sortRating" },
  { value: "primary_release_date.desc", labelKey: "discover.sortRecent" },
] as const;

export default function Discover() {
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<"all" | "movie" | "tv">("all");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const resultsRef = useRef<HTMLDivElement>(null);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [genreList, setGenreList] = useState<Tag[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<Tag[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<Tag[]>([]);
  const [selectedActors, setSelectedActors] = useState<Tag[]>([]);
  const [selectedDirectors, setSelectedDirectors] = useState<Tag[]>([]);
  const [sortBy, setSortBy] = useState<string>("popularity.desc");
  const [minVoteAverage, setMinVoteAverage] = useState(0);

  // Filters only fire a request once "Applica filtri" is pressed — this snapshot is
  // what actually drives the query, decoupled from the live chip selections above,
  // so picking several chips before searching doesn't fire a request per click. Kept
  // as full Tag objects (not just ids) so the applied-filters summary can show names.
  const [appliedFilters, setAppliedFilters] = useState<null | {
    mediaType: "all" | "movie" | "tv";
    genres: Tag[];
    keywords: Tag[];
    cast: Tag[];
    crew: Tag[];
    sortBy: string;
    minVoteAverage: number;
  }>(null);
  const [totalResults, setTotalResults] = useState<number | null>(null);

  const keywordTypeahead = useTypeahead<Tag>(fetchTags("/api/tmdb/search-keyword"));
  const actorTypeahead = useTypeahead<Tag>(fetchTags("/api/tmdb/search-person"));
  const directorTypeahead = useTypeahead<Tag>(fetchTags("/api/tmdb/search-person"));

  const hasActiveFilters =
    selectedGenres.length > 0 ||
    selectedKeywords.length > 0 ||
    selectedActors.length > 0 ||
    selectedDirectors.length > 0 ||
    minVoteAverage > 0 ||
    sortBy !== "popularity.desc";

  const formatYear = (value?: string) => {
    if (!value) return "";
    const match = String(value).match(/\d{4}/);
    return match ? match[0] : String(value);
  };

  // Genre ids mean different things per media type, so the genre picker only
  // makes sense once a specific type is chosen; switching type invalidates any
  // previously picked genres (keyword/cast/director ids are type-agnostic) and
  // any already-applied filter results, since those were scoped to the old type.
  useEffect(() => {
    setSelectedGenres([]);
    setAppliedFilters(null);
    setTotalResults(null);
    if (mediaType === "all") {
      setGenreList([]);
      return;
    }
    fetch(`/api/tmdb/genres?type=${mediaType}`)
      .then((res) => res.json())
      .then((data) => setGenreList(data.genres || []))
      .catch(() => setGenreList([]));
  }, [mediaType]);

  // Trending on mount / when type changes, as long as there's no active search or filters
  // Trending, filtered-discover and free-text search all resolve asynchronously and can
  // land out of order (e.g. the mount-time trending fetch resolving after a fast search) —
  // a monotonic token means only the most recently issued request is ever applied.
  const requestTokenRef = useRef(0);

  useEffect(() => {
    async function fetchTrending() {
      const token = ++requestTokenRef.current;
      try {
        setLoading(true);
        const res = await fetch(`/api/tmdb/trending?type=${mediaType}`);
        const data = await res.json();
        if (data.results && token === requestTokenRef.current) {
          setResults(data.results);
        }
      } catch (err) {
        console.error("Failed loading discover list:", err);
      } finally {
        if (token === requestTokenRef.current) setLoading(false);
      }
    }
    if (!query && !appliedFilters) {
      fetchTrending();
    }
  }, [mediaType, query, appliedFilters]);

  // Advanced filters only fire once "Applica filtri" sets appliedFilters — the two
  // modes (free-text search vs filters) are mutually exclusive since /discover has
  // no text-search param.
  useEffect(() => {
    async function fetchDiscover() {
      if (!appliedFilters) return;
      const token = ++requestTokenRef.current;
      try {
        setLoading(true);
        const params = new URLSearchParams({ type: appliedFilters.mediaType, sortBy: appliedFilters.sortBy });
        if (appliedFilters.genres.length) params.set("genres", appliedFilters.genres.map((g) => g.id).join(","));
        if (appliedFilters.keywords.length) params.set("keywords", appliedFilters.keywords.map((k) => k.id).join(","));
        if (appliedFilters.cast.length) params.set("cast", appliedFilters.cast.map((a) => a.id).join(","));
        if (appliedFilters.crew.length) params.set("crew", appliedFilters.crew.map((d) => d.id).join(","));
        if (appliedFilters.minVoteAverage) params.set("minVoteAverage", String(appliedFilters.minVoteAverage));

        const res = await fetch(`/api/tmdb/discover?${params.toString()}`);
        const data = await res.json();
        if (data.results && token === requestTokenRef.current) {
          setResults(data.results);
          setTotalResults(typeof data.totalResults === "number" ? data.totalResults : null);
        }
      } catch (err) {
        console.error("Failed loading filtered discover results:", err);
      } finally {
        if (token === requestTokenRef.current) setLoading(false);
      }
    }
    if (!query && appliedFilters) {
      fetchDiscover();
    }
  }, [query, appliedFilters]);

  const applyFilters = () => {
    setAppliedFilters({
      mediaType,
      genres: selectedGenres,
      keywords: selectedKeywords,
      cast: selectedActors,
      crew: selectedDirectors,
      sortBy,
      minVoteAverage,
    });
    setAdvancedOpen(false);
  };

  // Handle Search input — free-text search always wins over advanced filters
  const handleSearch = async (val: string) => {
    setQuery(val);
    if (!val) return;
    const token = ++requestTokenRef.current;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(val)}&type=${mediaType}`);
        const data = await res.json();
        if (data.results && token === requestTokenRef.current) {
          setResults(data.results);
        }
      } catch (err) {
        console.error("Search error:", err);
      }
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur(); // dismiss the mobile keyboard
      scrollBelowNavbar(resultsRef.current);
    }
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedKeywords([]);
    setSelectedActors([]);
    setSelectedDirectors([]);
    setSortBy("popularity.desc");
    setMinVoteAverage(0);
    setAppliedFilters(null);
    setTotalResults(null);
  };

  const toggleGenre = (genre: Tag) => {
    setSelectedGenres((prev) =>
      prev.some((g) => g.id === genre.id) ? prev.filter((g) => g.id !== genre.id) : [...prev, genre]
    );
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 flex-1 flex flex-col">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("discover.title")}</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm mt-1">
            {t("discover.subtitle")}
          </p>
        </div>

        {/* Media type toggles */}
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800 self-start">
          {(["all", "movie", "tv"] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setMediaType(type);
                setQuery(""); // Clear search query to reload appropriate trending
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mediaType === type
                ? "bg-white dark:bg-zinc-800 text-yellow-600 dark:text-yellow-400 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
            >
              {type === "all" ? t("discover.all") : type === "movie" ? t("discover.movies") : t("discover.tvShows")}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input Box */}
      <div className="relative mb-4">
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
          className="block w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 shadow-sm transition-all text-base"
        />
        {(loading || isPending) && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-yellow-600 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Advanced filters toggle */}
      <button
        onClick={() => setAdvancedOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 self-start mb-4 text-xs font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400 hover:underline"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {t("discover.advancedFilters")}
        {hasActiveFilters && (
          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-yellow-600 text-white text-[10px] font-black">
            {selectedGenres.length + selectedKeywords.length + selectedActors.length + selectedDirectors.length}
          </span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
      </button>

      {advancedOpen && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl p-5 mb-8 space-y-5">
          {/* Genres */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              {t("discover.genresLabel")}
            </label>
            {mediaType === "all" ? (
              // Genres are per-type on TMDB, so offer the type switch right here — the
              // page-level toggle sits far above the panel and isn't an obvious next step.
              <div className="space-y-2">
                <p className="text-xs text-zinc-400 italic">{t("discover.genresRequireType")}</p>
                <div className="flex flex-wrap gap-2">
                  {(["movie", "tv"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setMediaType(type);
                        setQuery("");
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {type === "movie" ? t("discover.movies") : t("discover.tvShows")}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {genreList.map((genre) => (
                  <button
                    key={genre.id}
                    onClick={() => toggleGenre(genre)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      selectedGenres.some((g) => g.id === genre.id)
                        ? "bg-yellow-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Keywords — TMDB tags aren't localized (unlike genre names), so this only
              matches English input regardless of the app's language. */}
          <TagPicker
            label={t("discover.keywordsLabel")}
            hint={t("discover.keywordsHint")}
            placeholder={t("discover.keywordsPlaceholder")}
            typeahead={keywordTypeahead}
            selected={selectedKeywords}
            onAdd={(tag) => setSelectedKeywords((prev) => (prev.some((k) => k.id === tag.id) ? prev : [...prev, tag]))}
            onRemove={(id) => setSelectedKeywords((prev) => prev.filter((k) => k.id !== id))}
          />

          {/* Actors */}
          <TagPicker
            label={t("discover.actorsLabel")}
            placeholder={t("discover.actorsPlaceholder")}
            typeahead={actorTypeahead}
            selected={selectedActors}
            onAdd={(tag) => setSelectedActors((prev) => (prev.some((a) => a.id === tag.id) ? prev : [...prev, tag]))}
            onRemove={(id) => setSelectedActors((prev) => prev.filter((a) => a.id !== id))}
          />

          {/* Directors */}
          <TagPicker
            label={t("discover.directorsLabel")}
            placeholder={t("discover.directorsPlaceholder")}
            typeahead={directorTypeahead}
            selected={selectedDirectors}
            onAdd={(tag) => setSelectedDirectors((prev) => (prev.some((d) => d.id === tag.id) ? prev : [...prev, tag]))}
            onRemove={(id) => setSelectedDirectors((prev) => prev.filter((d) => d.id !== id))}
          />

          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                {t("discover.sortLabel")}
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 font-semibold focus:outline-none focus:ring-1 focus:ring-yellow-500"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                {t("discover.minRatingLabel")}
              </label>
              <select
                value={minVoteAverage}
                onChange={(e) => setMinVoteAverage(Number(e.target.value))}
                className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 font-semibold focus:outline-none focus:ring-1 focus:ring-yellow-500"
              >
                <option value={0}>{t("discover.anyRating")}</option>
                {[9, 8, 7, 6, 5].map((v) => (
                  <option key={v} value={v}>{v}+</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={applyFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              {t("discover.applyFilters")}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-bold text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                {t("discover.clearFilters")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters indicator / Header */}
      <div ref={resultsRef} className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            {query
              ? t("discover.searchResultsFor", { query })
              : appliedFilters
                ? t("discover.filteredResults")
                : t("discover.trendingThisWeek")}
          </span>
        </div>
        {!query && appliedFilters && typeof totalResults === "number" && (
          <span className="text-xs font-bold text-zinc-400">
            {t("discover.resultsCount", { count: formatNumber(totalResults) })}
          </span>
        )}
      </div>

      {/* Applied filters summary — the panel itself closes on "Applica filtri", so this
          is the only visible trace of what's currently driving the results below. */}
      {!query && appliedFilters && (
        <div className="flex flex-wrap items-center gap-1.5 mb-6">
          {[
            ...appliedFilters.genres.map((t) => ({ key: `g-${t.id}`, name: t.name })),
            ...appliedFilters.keywords.map((t) => ({ key: `k-${t.id}`, name: t.name })),
            ...appliedFilters.cast.map((t) => ({ key: `a-${t.id}`, name: t.name })),
            ...appliedFilters.crew.map((t) => ({ key: `d-${t.id}`, name: t.name })),
          ].map((chip) => (
            <span key={chip.key} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {chip.name}
            </span>
          ))}
          {appliedFilters.minVoteAverage > 0 && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {appliedFilters.minVoteAverage}+
            </span>
          )}
          {appliedFilters.sortBy !== "popularity.desc" && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {t(SORT_OPTIONS.find((opt) => opt.value === appliedFilters.sortBy)?.labelKey || "discover.sortPopularity")}
            </span>
          )}
          <button
            onClick={() => setAdvancedOpen(true)}
            className="text-xs font-bold text-yellow-600 dark:text-yellow-400 hover:underline"
          >
            {t("discover.editFilters")}
          </button>
        </div>
      )}

      {/* Results grid */}
      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-zinc-900/40 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8">
          <Film className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-4" />
          <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-200">{t("discover.noTitlesFound")}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mt-1">
            {t("discover.noTitlesHint")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {results.map((media) => (
            <Link
              key={`${media.media_type || "movie"}-${media.id}`}
              href={`/media/${media.media_type || "movie"}/${media.id}`}
              className="group flex flex-col bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="relative aspect-2/3 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <Image
                  src={media.poster_path || "/"}
                  alt={media.title || "Media poster"}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
                <div className="absolute top-2 right-2 bg-zinc-950/80 backdrop-blur-md text-white font-bold text-xxs px-2 py-0.5 rounded shadow">
                  {t(`mediaType.${media.media_type || "movie"}`).toUpperCase()}
                </div>
                {media.vote_average > 0 && (
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-zinc-950/80 backdrop-blur-sm text-yellow-400 text-xs font-bold px-1.5 py-0.5 rounded">
                    <Star className="h-3 w-3 fill-current" />
                    {media.vote_average.toFixed(1)}
                  </div>
                )}
              </div>
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 line-clamp-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                    {media.title}
                  </h3>
                  <p className="text-xxs text-zinc-400 dark:text-zinc-500 line-clamp-2 mt-1">
                    {media.overview || t("discover.noSynopsis")}
                  </p>
                </div>
                {media.release_date && (
                  <div className="text-xxs text-zinc-400 dark:text-zinc-500 font-semibold mt-3">
                    {formatYear(media.release_date)}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

interface TagPickerProps<T extends Tag> {
  label: string;
  placeholder: string;
  hint?: string;
  typeahead: {
    query: string;
    setQuery: (v: string) => void;
    suggestions: T[];
    setSuggestions: (v: T[]) => void;
  };
  selected: Tag[];
  onAdd: (tag: T) => void;
  onRemove: (id: number) => void;
}

function TagPicker<T extends Tag>({ label, placeholder, hint, typeahead, selected, onAdd, onRemove }: TagPickerProps<T>) {
  const { query, setQuery, suggestions, setSuggestions } = typeahead;

  return (
    <div>
      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">{label}</label>
      {hint && <p className="text-[11px] text-zinc-400 italic mb-2">{hint}</p>}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-yellow-600 text-white"
            >
              {tag.name}
              <button onClick={() => onRemove(tag.id)} aria-label="Rimuovi">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative max-w-xs">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 font-semibold focus:outline-none focus:ring-1 focus:ring-yellow-500"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onAdd(s);
                  setQuery("");
                  setSuggestions([]);
                }}
                className="block w-full text-left px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
