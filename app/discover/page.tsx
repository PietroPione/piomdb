/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Film, SlidersHorizontal, Star } from "lucide-react";
import { t } from "@/lib/i18n";

export default function Discover() {
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<"all" | "movie" | "tv">("all");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const formatYear = (value?: string) => {
    if (!value) return "";
    const match = String(value).match(/\d{4}/);
    return match ? match[0] : String(value);
  };

  // Load trending on mount
  useEffect(() => {
    async function fetchTrending() {
      try {
        setLoading(true);
        const res = await fetch(`/api/tmdb/trending?type=${mediaType}`);
        const data = await res.json();
        if (data.results) {
          setResults(data.results);
        }
      } catch (err) {
        console.error("Failed loading discover list:", err);
      } finally {
        setLoading(false);
      }
    }
    if (!query) {
      fetchTrending();
    }
  }, [mediaType, query]);

  // Handle Search input
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
      } catch (err) {
        console.error("Search error:", err);
      }
    });
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
      <div className="relative mb-10">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-zinc-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t("discover.searchPlaceholder")}
          className="block w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 shadow-sm transition-all text-base"
        />
        {(loading || isPending) && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-yellow-600 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Filters indicator / Header */}
      <div className="flex items-center gap-2 mb-6">
        <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          {query ? t("discover.searchResultsFor", { query }) : t("discover.trendingThisWeek")}
        </span>
      </div>

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
