/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, Play, Clock, TrendingUp, Sparkles } from "lucide-react";
import { getCurrentUser, getTrackedMedia, TrackedMedia } from "@/lib/db";

export default function Home() {
  const [trending, setTrending] = useState<any[]>([]);
  const [currentlyWatching, setCurrentlyWatching] = useState<TrackedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

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
        setLoading(true);
        // Load User
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        // Fetch Trending
        const response = await fetch("/api/tmdb/trending?type=all");
        const json = await response.json();
        if (json.results) {
          setTrending(json.results.slice(0, 8));
        }

        // Fetch Currently Watching shelf if user logged in
        if (currentUser) {
          const tracked = await getTrackedMedia(currentUser.id);
          setCurrentlyWatching(tracked.filter((item) => item.status === "Currently Watching"));
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-950 to-zinc-950 text-white py-20 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.25),rgba(255,255,255,0))]" />

        <div className="max-w-5xl mx-auto relative z-10 text-center sm:text-left flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div className="max-w-2xl space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              <Sparkles className="h-3.5 w-3.5" />
              Welcome to PioMDB
            </span>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              Track movies & TV shows. <br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                Never lose your spot.
              </span>
            </h1>
            <p className="text-zinc-300 text-lg sm:text-xl max-w-xl font-medium">
              Create your personal watchlist, mark shows as watched, rate your favorites, and build your profile statistics.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/discover"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5"
              >
                <Play className="h-4 w-4 fill-current" />
                Discover Now
              </Link>
              {!user && (
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-zinc-900/60 hover:bg-zinc-900/80 text-white border border-zinc-800 transition-all"
                >
                  Create Free Account
                </Link>
              )}
            </div>
          </div>

          {/* Quick Metrics Badge in Hero */}
          <div className="hidden lg:flex flex-col gap-4 bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl w-80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Clock className="text-indigo-400 h-5 w-5" />
              <span className="font-semibold text-zinc-200 text-sm">Features At A Glance</span>
            </div>
            <div className="space-y-3 pt-2 text-xs text-zinc-400 font-medium">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                <span>Track Watched / Want to Watch lists</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                <span>Custom Order & Toggle TV/Movie details</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                <span>Supabase Database Sync</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                <span>Online / Local Fallback Mock DB Mode</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Currently Watching Shelf */}
      {user && currentlyWatching.length > 0 && (
        <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-12">
          <div className="flex items-center gap-2 mb-6">
            <Play className="h-5 w-5 text-indigo-600 dark:text-indigo-400 fill-current" />
            <h2 className="text-2xl font-bold tracking-tight">Currently Watching</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {currentlyWatching.map((media) => (
              <Link
                key={`${media.media_type}-${media.media_id}`}
                href={`/media/${media.media_type}/${media.media_id}`}
                className="group relative flex flex-col bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  <Image
                    src={media.poster_path}
                    alt={media.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    unoptimized
                  />
                  <div className="absolute top-2 right-2 bg-indigo-600 text-white font-bold text-xxs px-2 py-0.5 rounded shadow">
                    {media.media_type.toUpperCase()}
                  </div>
                </div>
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {media.title}
                  </h3>
                  <div className="text-xxs text-zinc-500 font-semibold mt-1">
                    Progress: Watching
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Main Trending List */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-12 flex-1">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-2xl font-bold tracking-tight">Trending This Week</h2>
          </div>
          <Link
            href="/discover"
            className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Explore all
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
            {trending.map((media) => (
              <Link
                key={`${media.media_type}-${media.id}`}
                href={`/media/${media.media_type}/${media.id}`}
                className="group flex flex-col bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  <Image
                    src={media.poster_path}
                    alt={media.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    unoptimized
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className="bg-zinc-950/80 backdrop-blur-md text-white font-bold text-xxs px-2 py-0.5 rounded shadow">
                      {media.media_type.toUpperCase()}
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
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {media.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1.5">
                      {media.overview}
                    </p>
                  </div>
                  {media.release_date && (
                    <div className="text-xxs text-zinc-400 font-semibold mt-3">
                      {new Date(media.release_date).getFullYear()}
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
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{activity.name}</span>{" "}
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
