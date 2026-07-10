/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser, getTrackedMedia, TrackedMedia, UserProfile } from "@/lib/db";
import { Star, Clock, LayoutGrid, Award } from "lucide-react";

export default function Profile() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tracked, setTracked] = useState<TrackedMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        if (currentUser) {
          const items = await getTrackedMedia(currentUser.id);
          setTracked(items);
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-20 px-6 text-center">
        <div className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold">No Profile Found</h2>
        <p className="text-sm text-zinc-500 mt-2">
          Please sign in to view your profile dashboard and tracking statistics.
        </p>
        <Link href="/login" className="inline-block mt-4 text-indigo-600 font-semibold hover:underline text-sm">
          Sign In Now
        </Link>
      </div>
    );
  }

  // Calculate statistics
  const totalWatched = tracked.filter((i) => i.status === "Watched").length;
  const currentlyWatching = tracked.filter((i) => i.status === "Currently Watching").length;
  const watchlistCount = tracked.filter((i) => i.status === "Want to Watch").length;

  const ratedItems = tracked.filter((i) => typeof i.user_rating === "number");
  const averageRating = ratedItems.length > 0
    ? (ratedItems.reduce((acc, curr) => acc + (curr.user_rating || 0), 0) / ratedItems.length).toFixed(1)
    : "N/A";

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 flex-1 flex flex-col">
      {/* Profile Header */}
      <section className="bg-gradient-to-br from-zinc-900 to-zinc-950 text-white rounded-3xl p-6 sm:p-10 mb-8 border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)] pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          {/* Avatar avatar */}
          <div className="h-20 w-20 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-3xl uppercase tracking-wider text-white shadow-lg shadow-indigo-500/20">
            {user.username ? user.username[0] : user.email[0]}
          </div>

          <div className="space-y-2 flex-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-50">
              {user.username || user.email.split("@")[0]}
            </h1>
            <p className="text-zinc-400 text-sm font-semibold">
              {user.email}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xxs font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Recently"}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xxs font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
                <Award className="h-3.5 w-3.5 text-indigo-400" />
                Track Master
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Grid Statistics Shelf */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 text-center">
          <span className="block text-3xl font-black text-indigo-600 dark:text-indigo-400">
            {totalWatched}
          </span>
          <span className="block text-xxs font-black text-zinc-400 uppercase tracking-wider mt-1">
            Watched
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 text-center">
          <span className="block text-3xl font-black text-indigo-600 dark:text-indigo-400">
            {currentlyWatching}
          </span>
          <span className="block text-xxs font-black text-zinc-400 uppercase tracking-wider mt-1">
            Watching
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 text-center">
          <span className="block text-3xl font-black text-indigo-600 dark:text-indigo-400">
            {watchlistCount}
          </span>
          <span className="block text-xxs font-black text-zinc-400 uppercase tracking-wider mt-1">
            Watchlist
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 text-center">
          <span className="block text-3xl font-black text-amber-500">
            {averageRating}
          </span>
          <span className="block text-xxs font-black text-zinc-400 uppercase tracking-wider mt-1">
            Avg Rating
          </span>
        </div>
      </section>

      {/* Recent Activity Grid */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200/60 dark:border-zinc-800">
        <h2 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200 mb-6 flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Recently Tracked Activity
        </h2>

        {tracked.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-zinc-500 font-medium">No activity tracked yet.</p>
            <Link href="/discover" className="inline-block mt-3 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              Search & Add titles &rarr;
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {tracked.slice(0, 5).map((item) => (
              <div key={`${item.media_type}-${item.media_id}`} className="py-4 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-8 bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden flex-shrink-0">
                    <Image
                      src={item.poster_path}
                      alt={item.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div>
                    <Link
                      href={`/media/${item.media_type}/${item.media_id}`}
                      className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 transition-colors line-clamp-1"
                    >
                      {item.title}
                    </Link>
                    <span className="block text-xxs text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">
                      {item.media_type} &bull; {item.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.user_rating ? (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded">
                      <Star className="h-3 w-3 fill-current text-amber-500" />
                      {item.user_rating}
                    </span>
                  ) : (
                    <span className="text-xxs text-zinc-400 font-bold uppercase tracking-wider">Unrated</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
