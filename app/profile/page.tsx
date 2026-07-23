"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  getCurrentUser,
  getTrackedMedia,
  getWatchedEpisodeCountsByMedia,
  TrackedMedia,
  UserProfile,
} from "@/lib/db";
import { Star, LayoutGrid, Film, Tv, Play, Bookmark } from "lucide-react";
import TvTimeImporter from "@/components/TvTimeImporter";
import { t } from "@/lib/i18n";
import { cachedFetch } from "@/lib/apiCache";
import { resolveWithConcurrency } from "@/lib/concurrency";
import { formatDuration } from "@/lib/duration";
import { formatNumber } from "@/lib/format";

const RUNTIME_SAMPLE_CONCURRENCY = 30;

interface ShowStats {
  count: number;
  episodes: number;
  minutes: number;
}

interface ProfileStats {
  moviesWatchedCount: number;
  moviesWatchedMinutes: number;
  showsWatched: ShowStats;
  showsWatching: ShowStats;
  showsPending: ShowStats;
}

// Fetching every episode's runtime would be exact but slow (one call per season
// per show). Instead we sample season 1 episode 1 as a proxy for the show's
// average episode length — one TMDB call per show, per the user's chosen tradeoff.
async function getAvgEpisodeRuntime(mediaId: string): Promise<number> {
  try {
    const data = await cachedFetch(`season-tv-${mediaId}-1`, async () => {
      const res = await fetch(`/api/tmdb/season?type=tv&id=${mediaId}&season=1`);
      return res.json();
    });
    const episodes = (data?.episodes || []) as { runtime: number | null }[];
    const withRuntime = episodes.find((ep) => typeof ep.runtime === "number" && ep.runtime > 0);
    return withRuntime?.runtime || 0;
  } catch {
    return 0;
  }
}

/** One big number with its caption. `accent` marks the headline figure of a card. */
function StatTile({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <span
        className={`block text-4xl font-black ${
          accent ? "text-yellow-600 dark:text-yellow-400" : "text-zinc-900 dark:text-zinc-50"
        }`}
      >
        {formatNumber(value)}
      </span>
      <span className="block text-xxs font-bold text-zinc-400 uppercase tracking-wider mt-1">{label}</span>
    </div>
  );
}

/** A stats card: icon + title, a row of tiles, and an optional prose footer. */
function StatCard({
  icon: Icon,
  title,
  footer,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200/60 dark:border-zinc-800">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        <span className="text-sm font-black uppercase tracking-wider text-zinc-500">{title}</span>
      </div>
      <div className="flex items-end gap-6 flex-wrap">{children}</div>
      {footer && (
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          {footer}
        </p>
      )}
    </div>
  );
}

export default function Profile() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tracked, setTracked] = useState<TrackedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    async function computeStats(userId: string, items: TrackedMedia[]) {
      setStatsLoading(true);
      try {
        const movies = items.filter((i) => i.media_type === "movie" && i.status === "Watched");
        const watchedShows = items.filter((i) => i.media_type === "tv" && i.status === "Watched");
        const watchingShows = items.filter((i) => i.media_type === "tv" && i.status === "Currently Watching");
        const pendingShows = items.filter((i) => i.media_type === "tv" && i.status === "Want to Watch");
        const allShows = [...watchedShows, ...watchingShows, ...pendingShows];

        // Most shows already have avg_episode_runtime saved in the DB (populated at track
        // time / by the TV Time importer) — only shows tracked before that existed need a
        // live TMDB sample, which keeps the common case free of any TMDB calls.
        const showsMissingRuntime = allShows.filter((show) => !show.avg_episode_runtime);

        const [watchedCounts, sampledRuntimes] = await Promise.all([
          getWatchedEpisodeCountsByMedia(userId),
          resolveWithConcurrency(showsMissingRuntime, RUNTIME_SAMPLE_CONCURRENCY, (show) =>
            getAvgEpisodeRuntime(show.media_id)
          ),
        ]);
        const avgRuntimeByMediaId: Record<string, number> = {};
        allShows.forEach((show) => {
          if (show.avg_episode_runtime) avgRuntimeByMediaId[show.media_id] = show.avg_episode_runtime;
        });
        showsMissingRuntime.forEach((show, idx) => {
          avgRuntimeByMediaId[show.media_id] = sampledRuntimes[idx];
        });

        const showsWatched = watchedShows.reduce<ShowStats>(
          (acc, show) => {
            const total = show.total_episodes || 0;
            acc.count += 1;
            acc.episodes += total;
            acc.minutes += total * (avgRuntimeByMediaId[show.media_id] || 0);
            return acc;
          },
          { count: 0, episodes: 0, minutes: 0 }
        );

        const showsWatching = watchingShows.reduce<ShowStats>(
          (acc, show) => {
            const total = show.total_episodes || 0;
            const watchedCount = watchedCounts[show.media_id] || 0;
            const remaining = Math.max(0, total - watchedCount);
            acc.count += 1;
            acc.episodes += remaining;
            acc.minutes += remaining * (avgRuntimeByMediaId[show.media_id] || 0);
            return acc;
          },
          { count: 0, episodes: 0, minutes: 0 }
        );

        const showsPending = pendingShows.reduce<ShowStats>(
          (acc, show) => {
            const total = show.total_episodes || 0;
            acc.count += 1;
            acc.episodes += total;
            acc.minutes += total * (avgRuntimeByMediaId[show.media_id] || 0);
            return acc;
          },
          { count: 0, episodes: 0, minutes: 0 }
        );

        setStats({
          moviesWatchedCount: movies.length,
          moviesWatchedMinutes: movies.reduce((sum, m) => sum + (m.runtime || 0), 0),
          showsWatched,
          showsWatching,
          showsPending,
        });
      } catch (err) {
        console.error("Failed to compute profile stats:", err);
      } finally {
        setStatsLoading(false);
      }
    }

    async function loadProfile() {
      try {
        setLoading(true);
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        if (currentUser) {
          const items = await getTrackedMedia(currentUser.id);
          setTracked(items);
          computeStats(currentUser.id, items);
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-yellow-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-20 px-6 text-center">
        <div className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold">{t("profile.noProfileTitle")}</h2>
        <p className="text-sm text-zinc-500 mt-2">
          {t("profile.noProfileBody")}
        </p>
        <Link href="/login" className="inline-block mt-4 text-yellow-600 font-semibold hover:underline text-sm">
          {t("profile.signInNow")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 flex-1 flex flex-col">
      {/* Profile Header */}
      <section className="bg-gradient-to-br from-zinc-900 to-zinc-950 text-white rounded-3xl p-6 sm:p-10 mb-8 border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)] pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          {/* Avatar avatar */}
          <div className="h-20 w-20 rounded-2xl bg-yellow-600 flex items-center justify-center font-black text-3xl uppercase tracking-wider text-white shadow-lg shadow-yellow-500/20">
            {user.username ? user.username[0] : user.email[0]}
          </div>

          <div className="space-y-2 flex-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-50">
              {user.username || user.email.split("@")[0]}
            </h1>
            <p className="text-zinc-400 text-sm font-semibold">
              {user.email}
            </p>
          </div>
        </div>
      </section>

      {/* Statistics Dashboard */}
      <section className="mb-8">
        <h2 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200 mb-4">
          {t("profile.statsTitle")}
        </h2>

        {statsLoading || !stats ? (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-10 border border-zinc-200/60 dark:border-zinc-800 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-solid border-yellow-600 border-t-transparent mx-auto mb-3" />
            <p className="text-sm text-zinc-500 font-medium">{t("profile.statsComputing")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              icon={Film}
              title={t("profile.statsMoviesTitle")}
              footer={formatDuration(stats.moviesWatchedMinutes)}
            >
              <StatTile value={stats.moviesWatchedCount} label={t("profile.statsFilmsLabel")} />
              <StatTile value={stats.moviesWatchedMinutes} label={t("profile.statsMinutesLabel")} accent />
            </StatCard>

            <StatCard
              icon={Tv}
              title={t("profile.statsShowsWatchedTitle")}
              footer={formatDuration(stats.showsWatched.minutes)}
            >
              <StatTile value={stats.showsWatched.count} label={t("profile.statsShowsLabel")} />
              <StatTile value={stats.showsWatched.episodes} label={t("profile.statsEpisodesWatchedLabel")} />
              <StatTile value={stats.showsWatched.minutes} label={t("profile.statsMinutesLabel")} accent />
            </StatCard>

            <StatCard
              icon={Play}
              title={t("profile.statsShowsWatchingTitle")}
              footer={formatDuration(stats.showsWatching.minutes)}
            >
              <StatTile value={stats.showsWatching.count} label={t("profile.statsShowsLabel")} />
              <StatTile value={stats.showsWatching.episodes} label={t("profile.statsEpisodesRemainingLabel")} />
              <StatTile value={stats.showsWatching.minutes} label={t("profile.statsMinutesRemainingLabel")} accent />
            </StatCard>

            <StatCard
              icon={Bookmark}
              title={t("profile.statsShowsPendingTitle")}
              footer={formatDuration(stats.showsPending.minutes)}
            >
              <StatTile value={stats.showsPending.count} label={t("profile.statsShowsLabel")} />
              <StatTile value={stats.showsPending.episodes} label={t("profile.statsEpisodesRemainingLabel")} />
              <StatTile value={stats.showsPending.minutes} label={t("profile.statsMinutesRemainingLabel")} accent />
            </StatCard>
          </div>
        )}
      </section>

      {/* Recent Activity Grid */}
      <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200/60 dark:border-zinc-800">
        <h2 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200 mb-6 flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          {t("profile.recentActivity")}
        </h2>

        {tracked.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-zinc-500 font-medium">{t("profile.noActivity")}</p>
            <Link href="/discover" className="inline-block mt-3 text-xs font-bold text-yellow-600 dark:text-yellow-400 hover:underline">
              {t("profile.searchAddTitles")}
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
                      className="font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-yellow-600 transition-colors line-clamp-1"
                    >
                      {item.title}
                    </Link>
                    <span className="block text-xxs text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">
                      {t(`mediaType.${item.media_type}`)} &bull; {t(`status.${item.status}`)}
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
                    <span className="text-xxs text-zinc-400 font-bold uppercase tracking-wider">{t("profile.unrated")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8">
        <TvTimeImporter />
      </div>
    </div>
  );
}
