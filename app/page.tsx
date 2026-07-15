/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Star, Play, Clock, TrendingUp, Sparkles } from "lucide-react";
import { getCurrentUser, getTrackedMedia, TrackedMedia } from "@/lib/db";
import { t } from "@/lib/i18n";

export default function Home() {
  const [results, setResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [currentlyWatching, setCurrentlyWatching] = useState<TrackedMedia[]>([]);
  const [user, setUser] = useState<any>(null);

  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<"all" | "movie" | "tv">("all");
  const [isPending, startTransition] = useTransition();

  // Hidden/Private mock activity feed for friends
  const [showFriendsActivity] = useState(false); // Flag configured as false to keep section hidden as requested
  const mockFriendsActivity = [
    { name: "John", action: "watched", title: "Inception", type: "movie", time: "10m ago" },
    { name: "Sarah", action: "added to watchlist", title: "Breaking Bad", type: "tv", time: "1h ago" },
    { name: "David", action: "rated 10/10", title: "Interstellar", type: "movie", time: "3h ago" }
  ];

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        if (currentUser) {
          const tracked = await getTrackedMedia(currentUser.id);
          setCurrentlyWatching(tracked.filter((item) => item.status === "Currently Watching"));
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      }
    }

    loadDashboardData();
  }, []);

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
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
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
      </section>

      {/* Currently Watching Shelf - hidden while actively searching so results don't have to compete for attention */}
      {user && !query && currentlyWatching.length > 0 && (
        <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-12">
          <div className="flex items-center gap-2 mb-6">
            <Play className="h-5 w-5 text-yellow-600 dark:text-yellow-400 fill-current" />
            <h2 className="text-2xl font-bold tracking-tight">{t("home.currentlyWatching")}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {currentlyWatching.map((media) => (
              <Link
                key={`${media.media_type}-${media.media_id}`}
                href={`/media/${media.media_type}/${media.media_id}`}
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
                  <div className="text-xxs text-zinc-500 font-semibold mt-1">
                    {t("home.progressWatching")}
                  </div>
                </div>
              </Link>
            ))}
          </div>
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
