/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DETAIL_LAYOUT_CONFIG } from "@/config/detailLayout";
import {
  getCurrentUser,
  getTrackedMedia,
  upsertTrackedMedia,
  deleteTrackedMedia,
  getWatchedEpisodes,
  setEpisodeWatched,
  setSeasonWatched,
  TrackedMedia,
} from "@/lib/db";
import { ChevronLeft, Star, Film, Tv, AlertCircle, Check, ChevronDown, Heart } from "lucide-react";
import { cachedFetch } from "@/lib/apiCache";
import { extractTasteProfile } from "@/lib/tasteProfile";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";

interface SeasonEpisode {
  episode: number;
  title: string;
  released: string;
  vote_average: number;
  runtime: number | null;
}

interface PageProps {
  params: Promise<{
    type: string;
    id: string;
  }>;
}

export default function MediaDetail({ params }: PageProps) {
  const router = useRouter();

  // Unwrap params using React.use()
  const { type, id } = use(params);
  const mediaType = type as "movie" | "tv";

  const [media, setMedia] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [trackingState, setTrackingState] = useState<TrackedMedia | null>(null);
  const [saving, setSaving] = useState(false);

  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set());
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());
  const [seasonEpisodes, setSeasonEpisodes] = useState<Record<number, SeasonEpisode[]>>({});
  const [loadingSeasons, setLoadingSeasons] = useState<Set<number>>(new Set());
  const [totalEpisodes, setTotalEpisodes] = useState<number | null>(null);
  const [totalMinutes, setTotalMinutes] = useState(0);

  const formatDate = (value?: string) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleDateString("it-IT", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load User
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        // Fetch Detail info from Secure API Route (cached — title/poster/overview don't change)
        // -v2: detail payloads gained `keywords`; older cached entries lack it and would
        // silently starve the taste profile until they expired.
        const detailData = await cachedFetch(`detail-v2-${mediaType}-${id}`, async () => {
          const res = await fetch(`/api/tmdb/detail?type=${mediaType}&id=${id}`);
          if (!res.ok) throw new Error("Could not load media details");
          const data = await res.json();
          // The API route returns a 200 with a null body when the id doesn't resolve on
          // TMDB (e.g. a stale pre-migration id) — treat that as a failure so it isn't
          // cached for a week and so the page falls through to the "not found" state.
          if (!data) throw new Error("Media not found");
          return data;
        });
        setMedia(detailData);

        // Seasons/episodes are prefetched (cached per-season, so repeat visits are free) so
        // the completion bar can show total minutes and every season opens instantly.
        if (mediaType === "tv" && detailData.number_of_seasons) {
          const seasons = Array.from({ length: detailData.number_of_seasons }, (_, i) => i + 1);
          const seasonLists = await Promise.all(
            seasons.map((season) =>
              cachedFetch(`season-${mediaType}-${id}-${season}`, async () => {
                const res = await fetch(`/api/tmdb/season?type=${mediaType}&id=${id}&season=${season}`);
                return res.json();
              })
            )
          );

          const episodesBySeason: Record<number, SeasonEpisode[]> = {};
          let minutesSum = 0;
          seasonLists.forEach((data, idx) => {
            const episodes = (data.episodes || []) as SeasonEpisode[];
            episodesBySeason[seasons[idx]] = episodes;
            minutesSum += episodes.reduce((sum, ep) => sum + (ep.runtime || 0), 0);
          });

          setSeasonEpisodes(episodesBySeason);
          setTotalMinutes(minutesSum);
          setTotalEpisodes(
            detailData.number_of_episodes || Object.values(episodesBySeason).reduce((sum, eps) => sum + eps.length, 0)
          );
        }

        // Fetch User's Tracking State if authenticated
        if (currentUser) {
          const trackedList = await getTrackedMedia(currentUser.id);
          const matched = trackedList.find(
            (item) => item.media_id === id && item.media_type === mediaType
          );
          if (matched) setTrackingState(matched);

          if (mediaType === "tv") {
            const watched = await getWatchedEpisodes(currentUser.id, id);
            setWatchedEpisodes(new Set(watched.map((w) => `${w.season}-${w.episode}`)));
          }
        }
      } catch (err) {
        console.error("Failed loading media:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, mediaType]);

  const markAllEpisodesWatched = async () => {
    if (!user || mediaType !== "tv" || !media.number_of_seasons) return;

    const seasons = Array.from({ length: media.number_of_seasons }, (_, i) => i + 1);
    const missing = seasons.filter((season) => !seasonEpisodes[season]);

    const fetched = await Promise.all(
      missing.map(async (season) => {
        const data = await cachedFetch(`season-${mediaType}-${id}-${season}`, async () => {
          const res = await fetch(`/api/tmdb/season?type=${mediaType}&id=${id}&season=${season}`);
          return res.json();
        });
        return [season, (data.episodes || []) as SeasonEpisode[]] as const;
      })
    );

    const allSeasonEpisodes: Record<number, SeasonEpisode[]> = { ...seasonEpisodes };
    for (const [season, episodes] of fetched) {
      allSeasonEpisodes[season] = episodes;
    }
    setSeasonEpisodes(allSeasonEpisodes);

    await Promise.all(
      seasons.map((season) =>
        setSeasonWatched(user.id, id, season, allSeasonEpisodes[season].map((e) => e.episode), true)
      )
    );

    setWatchedEpisodes((prev) => {
      const next = new Set(prev);
      for (const season of seasons) {
        for (const ep of allSeasonEpisodes[season]) {
          next.add(`${season}-${ep.episode}`);
        }
      }
      return next;
    });
  };

  const handleTrack = async (status: TrackedMedia["status"]) => {
    if (!user) {
      // Redirect to login
      router.push("/login");
      return;
    }

    try {
      setSaving(true);
      const payload: Omit<TrackedMedia, "user_id"> = {
        media_id: media.id,
        media_type: mediaType,
        title: media.title,
        poster_path: media.poster_path,
        status: status,
        user_rating: trackingState?.user_rating || undefined,
        is_favorite: trackingState?.is_favorite,
        total_episodes: mediaType === "tv" ? media.number_of_episodes : undefined,
        runtime: mediaType === "movie" ? media.runtime : undefined,
        // Already fetched as part of the season prefetch above — reuses that data instead
        // of an extra TMDB call, so the profile stats page never has to fetch it itself.
        avg_episode_runtime: mediaType === "tv" ? (seasonEpisodes[1]?.[0]?.runtime ?? undefined) : undefined,
        // Taste-profile signals (genres + themes), reused from the detail payload
        // already in memory so the home shelves never call TMDB again.
        ...extractTasteProfile(media),
      };

      const result = await upsertTrackedMedia(user.id, payload);
      if (result) {
        setTrackingState(result);
      }

      if (status === "Watched" && trackingState?.status !== "Watched") {
        await markAllEpisodesWatched();
      }
    } catch (err) {
      console.error("Failed saving tracking state:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      setSaving(true);
      const payload: Omit<TrackedMedia, "user_id"> = {
        media_id: media.id,
        media_type: mediaType,
        title: media.title,
        poster_path: media.poster_path,
        status: trackingState?.status || "Want to Watch",
        user_rating: trackingState?.user_rating || undefined,
        is_favorite: !trackingState?.is_favorite,
        total_episodes: mediaType === "tv" ? media.number_of_episodes : undefined,
        runtime: mediaType === "movie" ? media.runtime : undefined,
        // Already fetched as part of the season prefetch above — reuses that data instead
        // of an extra TMDB call, so the profile stats page never has to fetch it itself.
        avg_episode_runtime: mediaType === "tv" ? (seasonEpisodes[1]?.[0]?.runtime ?? undefined) : undefined,
        // Taste-profile signals (genres + themes), reused from the detail payload
        // already in memory so the home shelves never call TMDB again.
        ...extractTasteProfile(media),
      };

      const result = await upsertTrackedMedia(user.id, payload);
      if (result) {
        setTrackingState(result);
      }
    } catch (err) {
      console.error("Failed toggling favorite:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleUntrack = async () => {
    if (!user || !trackingState) return;
    try {
      setSaving(true);
      const ok = await deleteTrackedMedia(user.id, media.id, mediaType);
      if (ok) {
        setTrackingState(null);
      }
    } catch (err) {
      console.error("Failed deleting tracking state:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRate = async (rating: number) => {
    if (!user || !trackingState) return;
    try {
      setSaving(true);
      const payload: Omit<TrackedMedia, "user_id"> = {
        media_id: media.id,
        media_type: mediaType,
        title: media.title,
        poster_path: media.poster_path,
        status: trackingState.status,
        user_rating: rating,
        is_favorite: trackingState.is_favorite,
        total_episodes: mediaType === "tv" ? media.number_of_episodes : undefined,
        runtime: mediaType === "movie" ? media.runtime : undefined,
        // Already fetched as part of the season prefetch above — reuses that data instead
        // of an extra TMDB call, so the profile stats page never has to fetch it itself.
        avg_episode_runtime: mediaType === "tv" ? (seasonEpisodes[1]?.[0]?.runtime ?? undefined) : undefined,
        // Taste-profile signals (genres + themes), reused from the detail payload
        // already in memory so the home shelves never call TMDB again.
        ...extractTasteProfile(media),
      };
      const result = await upsertTrackedMedia(user.id, payload);
      if (result) {
        setTrackingState(result);
      }
    } catch (err) {
      console.error("Failed updating rating:", err);
    } finally {
      setSaving(false);
    }
  };

  const toggleSeasonExpand = async (season: number) => {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(season)) next.delete(season);
      else next.add(season);
      return next;
    });

    if (seasonEpisodes[season]) return;

    setLoadingSeasons((prev) => new Set(prev).add(season));
    try {
      const data = await cachedFetch(`season-${mediaType}-${id}-${season}`, async () => {
        const res = await fetch(`/api/tmdb/season?type=${mediaType}&id=${id}&season=${season}`);
        return res.json();
      });
      setSeasonEpisodes((prev) => ({ ...prev, [season]: data.episodes || [] }));
    } catch (err) {
      console.error("Failed loading season episodes:", err);
    } finally {
      setLoadingSeasons((prev) => {
        const next = new Set(prev);
        next.delete(season);
        return next;
      });
    }
  };

  // Once every episode is checked off, the show is done — flip status to Watched
  // even if it was untracked or "Currently Watching", regardless of how the last
  // episode got marked (single toggle or whole-season toggle).
  const maybeMarkFullyWatched = async (watchedCount: number) => {
    if (!user || !totalEpisodes || watchedCount < totalEpisodes) return;
    if (trackingState?.status === "Watched") return;

    const payload: Omit<TrackedMedia, "user_id"> = {
      media_id: media.id,
      media_type: mediaType,
      title: media.title,
      poster_path: media.poster_path,
      status: "Watched",
      user_rating: trackingState?.user_rating || undefined,
      is_favorite: trackingState?.is_favorite,
      total_episodes: totalEpisodes,
    };
    const result = await upsertTrackedMedia(user.id, payload);
    if (result) setTrackingState(result);
  };

  const handleToggleEpisode = async (season: number, episode: number) => {
    if (!user) {
      router.push("/login");
      return;
    }
    const key = `${season}-${episode}`;
    const nowWatched = !watchedEpisodes.has(key);
    await setEpisodeWatched(user.id, id, season, episode, nowWatched);

    const next = new Set(watchedEpisodes);
    if (nowWatched) next.add(key);
    else next.delete(key);
    setWatchedEpisodes(next);

    if (nowWatched) await maybeMarkFullyWatched(next.size);
  };

  const handleToggleSeason = async (season: number) => {
    if (!user) {
      router.push("/login");
      return;
    }
    const episodes = seasonEpisodes[season];
    if (!episodes || episodes.length === 0) return;

    const episodeNumbers = episodes.map((e) => e.episode);
    const allWatched = episodeNumbers.every((ep) => watchedEpisodes.has(`${season}-${ep}`));
    const markWatched = !allWatched;

    await setSeasonWatched(user.id, id, season, episodeNumbers, markWatched);

    const next = new Set(watchedEpisodes);
    for (const ep of episodeNumbers) {
      const key = `${season}-${ep}`;
      if (markWatched) next.add(key);
      else next.delete(key);
    }
    setWatchedEpisodes(next);

    if (markWatched) await maybeMarkFullyWatched(next.size);
  };

  const handleMarkAllSeen = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setSaving(true);
    try {
      await markAllEpisodesWatched();
      if (trackingState?.status !== "Watched") {
        const payload: Omit<TrackedMedia, "user_id"> = {
          media_id: media.id,
          media_type: mediaType,
          title: media.title,
          poster_path: media.poster_path,
          status: "Watched",
          user_rating: trackingState?.user_rating || undefined,
          is_favorite: trackingState?.is_favorite,
          total_episodes: totalEpisodes,
        };
        const result = await upsertTrackedMedia(user.id, payload);
        if (result) setTrackingState(result);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-yellow-600 border-t-transparent" />
      </div>
    );
  }

  if (!media) {
    return (
      <div className="max-w-md mx-auto my-20 text-center px-6">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">{t("mediaDetail.notFoundTitle")}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          {t("mediaDetail.notFoundBody")}
        </p>
        <Link href="/discover" className="inline-block mt-4 text-yellow-600 font-semibold hover:underline text-sm">
          {t("mediaDetail.returnToDiscover")}
        </Link>
      </div>
    );
  }

  const watchedMinutes = Object.entries(seasonEpisodes).reduce((sum, [season, episodes]) => {
    const minutes = episodes
      .filter((e) => watchedEpisodes.has(`${season}-${e.episode}`))
      .reduce((s, e) => s + (e.runtime || 0), 0);
    return sum + minutes;
  }, 0);

  // Render customizable blocks by ordering layout items configured in config/detailLayout.ts
  const renderBlocks = () => {
    return DETAIL_LAYOUT_CONFIG.filter((b) => b.enabled).map((block) => {
      switch (block.id) {
        case "header":
          return (
            <div key="header" className="relative bg-zinc-900 text-white rounded-3xl overflow-hidden shadow-2xl mb-10">
              {/* Backdrop Background with Overlay */}
              <div className="absolute inset-0 aspect-21/9 w-full">
                <Image
                  src={media.backdrop_path}
                  alt={media.title}
                  fill
                  className="object-cover opacity-25 filter blur-sm"
                  unoptimized
                />
                <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-900/80 to-transparent" />
              </div>

              {/* Header Content */}
              <div className="relative z-10 px-6 sm:px-12 py-12 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left mt-12">
                {/* Poster image */}
                <div className="relative w-48 sm:w-56 aspect-2/3 rounded-2xl overflow-hidden shadow-xl bg-zinc-800 shrink-0">
                  <Image
                    src={media.poster_path}
                    alt={media.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                {/* Text attributes */}
                <div className="flex-1 space-y-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-300">
                    {mediaType === "movie" ? (
                      <Film className="h-3.5 w-3.5" />
                    ) : (
                      <Tv className="h-3.5 w-3.5" />
                    )}
                    {mediaType === "movie" ? t("mediaType.movie") : t("mediaType.tv")}
                  </span>

                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none text-zinc-50">
                    {media.title}
                  </h1>

                  {media.tagline && (
                    <p className="text-yellow-200 text-sm sm:text-base italic font-medium leading-relaxed">
                      &ldquo;{media.tagline}&rdquo;
                    </p>
                  )}

                  {/* Episode Completion Progress */}
                  {user && mediaType === "tv" && !!totalEpisodes && (
                    <div className="w-full max-w-lg space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                        <span>{t("mediaDetail.episodeProgress")}</span>
                        <span>
                          {watchedEpisodes.size}/{totalEpisodes} ({Math.min(100, Math.round((watchedEpisodes.size / totalEpisodes) * 100))}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-yellow-500 transition-all"
                          style={{ width: `${Math.min(100, Math.round((watchedEpisodes.size / totalEpisodes) * 100))}%` }}
                        />
                      </div>
                      {totalMinutes > 0 && (
                        <div className="text-[10px] text-zinc-400 font-semibold text-right">
                          {t("mediaDetail.minutesWatched", { watched: formatNumber(watchedMinutes), total: formatNumber(totalMinutes) })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tracking Widget Panel */}
                  <div className="bg-zinc-950/60 p-4 sm:p-5 rounded-2xl border border-zinc-800/80 backdrop-blur-md inline-block text-left w-full max-w-lg mt-6">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">
                      {t("mediaDetail.myReviewTrackStatus")}
                    </h3>

                    {!user ? (
                      <div>
                        <p className="text-xs text-zinc-300 font-medium">
                          {t("mediaDetail.signInToRate")}
                        </p>
                        <Link
                          href="/login"
                          className="inline-block mt-3 text-xs font-bold text-yellow-400 hover:underline"
                        >
                          {t("mediaDetail.signInOrSignUp")}
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {(["Want to Watch", "Currently Watching", "Watched", "On Hold"] as const).map((status) => {
                            const isCurrent = trackingState?.status === status;
                            return (
                              <button
                                key={status}
                                disabled={saving}
                                onClick={() => handleTrack(status)}
                                className={`px-3 py-1.5 rounded-lg text-xxs font-bold uppercase tracking-wider transition-all ${isCurrent
                                  ? "bg-yellow-600 text-white shadow-md shadow-yellow-600/30"
                                  : "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300"
                                  }`}
                              >
                                {t(`status.${status}`)}
                              </button>
                            );
                          })}

                          {/* Favorite is independent of watch status - can apply to any status */}
                          <button
                            disabled={saving}
                            onClick={handleToggleFavorite}
                            aria-label={trackingState?.is_favorite ? t("mediaDetail.removeFromFavorites") : t("mediaDetail.addToFavorites")}
                            className={`ml-auto px-3 py-1.5 rounded-lg text-xxs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${trackingState?.is_favorite
                              ? "bg-pink-600 text-white shadow-md shadow-pink-600/30"
                              : "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300"
                              }`}
                          >
                            <Heart className={`h-3.5 w-3.5 ${trackingState?.is_favorite ? "fill-current" : ""}`} />
                            {t("mediaDetail.favorite")}
                          </button>
                        </div>

                        {trackingState && (
                          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-800/60">
                            {/* Star Rating Widget */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-zinc-300">{t("mediaDetail.myRating")}</span>
                              <select
                                disabled={saving}
                                value={trackingState.user_rating || ""}
                                onChange={(e) => handleRate(parseInt(e.target.value, 10))}
                                className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg p-1 font-bold focus:outline-none"
                              >
                                <option value="" disabled>{t("mediaDetail.rate")}</option>
                                {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
                                  <option key={r} value={r}>
                                    {r}/10
                                  </option>
                                ))}
                              </select>
                            </div>

                            <button
                              disabled={saving}
                              onClick={handleUntrack}
                              className="text-red-400 hover:text-red-300 text-xs font-bold transition-colors"
                            >
                              {t("mediaDetail.removeTracking")}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );

        case "rating":
          return (
            <div key="rating" className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 mb-6">
              <Star className="h-6 w-6 text-yellow-500 fill-current" />
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-extrabold text-lg text-zinc-900 dark:text-zinc-50">
                    {(Number(media.vote_average) || 0).toFixed(1)}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold">/10</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                  {(Number(media.vote_count) || 0).toLocaleString()} {t("mediaDetail.communityVotes")}
                </div>
              </div>
            </div>
          );

        case "genres":
          return (
            <div key="genres" className="flex flex-wrap gap-2 mb-6">
              {media.genres.map((g: any, index: number) => (
                <span
                  key={`${g.id ?? 'genre'}-${g.name ?? 'unknown'}-${index}`}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-200 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 border border-zinc-300/30 dark:border-zinc-800"
                >
                  {g.name}
                </span>
              ))}
            </div>
          );

        case "overview":
          return (
            <div key="overview" className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 space-y-3 mb-6 shadow-sm">
              <h2 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200">
                {t("mediaDetail.synopsis")}
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm font-medium">
                {media.overview || t("mediaDetail.noOverview")}
              </p>
            </div>
          );

        case "metadata":
          return (
            <div key="metadata" className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                <span className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                  {t("mediaDetail.statusLabel")}
                </span>
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {media.status}
                </span>
              </div>

              {media.release_date && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                  <span className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                    {t("mediaDetail.releaseDate")}
                  </span>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    {formatDate(media.release_date)}
                  </span>
                </div>
              )}

              {media.runtime && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                  <span className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                    {t("mediaDetail.runtime")}
                  </span>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    {media.runtime} {t("mediaDetail.minutes")}
                  </span>
                </div>
              )}

              {mediaType === "tv" && media.number_of_seasons && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                  <span className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                    {t("mediaDetail.seasons")}
                  </span>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    {media.number_of_seasons} {media.number_of_seasons === 1 ? t("mediaDetail.season") : t("mediaDetail.seasonsPlural")}
                    {media.number_of_episodes ? ` (${media.number_of_episodes} ep)` : ""}
                  </span>
                </div>
              )}
            </div>
          );

        case "episodes":
          return mediaType === "tv" && media.number_of_seasons ? (
            <div key="episodes" className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 mb-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200">
                  {t("mediaDetail.seasonsAndEpisodes")}
                </h2>
                {user && (
                  <button
                    disabled={saving || (!!totalEpisodes && watchedEpisodes.size >= totalEpisodes)}
                    onClick={handleMarkAllSeen}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xxs font-bold uppercase tracking-wider transition-all disabled:opacity-40 ${
                      !!totalEpisodes && watchedEpisodes.size >= totalEpisodes
                        ? "bg-yellow-600 text-white shadow-md shadow-yellow-600/30"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {t("mediaDetail.markAllSeen")}
                  </button>
                )}
              </div>

              {!user ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  <Link href="/login" className="text-yellow-600 dark:text-yellow-400 font-bold hover:underline">
                    {t("mediaDetail.signIn")}
                  </Link>{" "}
                  {t("mediaDetail.toTrackEpisodesSeen")}
                </p>
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: media.number_of_seasons }, (_, i) => i + 1).map((season) => {
                    const isExpanded = expandedSeasons.has(season);
                    const episodes = seasonEpisodes[season];
                    const isLoadingSeason = loadingSeasons.has(season);
                    const watchedCount = episodes
                      ? episodes.filter((e) => watchedEpisodes.has(`${season}-${e.episode}`)).length
                      : 0;
                    const allWatched = !!episodes && episodes.length > 0 && watchedCount === episodes.length;

                    return (
                      <div key={season} className="border border-zinc-200/60 dark:border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between gap-3 p-4 bg-zinc-50 dark:bg-zinc-950/40">
                          <button
                            onClick={() => toggleSeasonExpand(season)}
                            className="flex-1 flex items-center gap-2 text-left text-sm font-bold text-zinc-800 dark:text-zinc-100"
                          >
                            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            {t("mediaDetail.seasonLabel", { n: season })}
                            {episodes && (
                              <span className="text-xxs font-semibold text-zinc-400 normal-case">
                                {t("mediaDetail.seenCount", { watched: watchedCount, total: episodes.length })}
                              </span>
                            )}
                          </button>
                          <button
                            disabled={!episodes || episodes.length === 0}
                            onClick={() => handleToggleSeason(season)}
                            className={`shrink-0 px-3 py-1.5 rounded-lg text-xxs font-bold uppercase tracking-wider transition-all disabled:opacity-40 ${allWatched
                              ? "bg-yellow-600 text-white shadow-md shadow-yellow-600/30"
                              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                              }`}
                          >
                            {allWatched ? t("mediaDetail.seasonSeen") : t("mediaDetail.markSeasonSeen")}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                            {isLoadingSeason && (
                              <div className="p-4 text-xs text-zinc-400">{t("mediaDetail.loadingEpisodes")}</div>
                            )}
                            {episodes && episodes.map((ep) => {
                              const key = `${season}-${ep.episode}`;
                              const seen = watchedEpisodes.has(key);
                              return (
                                <div key={key} className="flex items-center justify-between gap-3 p-4">
                                  <div>
                                    <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
                                      {ep.episode}. {ep.title}
                                    </div>
                                    {(ep.released || ep.runtime) && (
                                      <div className="text-[10px] text-zinc-400 mt-0.5">
                                        {formatDate(ep.released)}
                                        {ep.released && ep.runtime ? " · " : ""}
                                        {ep.runtime ? `${ep.runtime} ${t("mediaDetail.minutes")}` : ""}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleToggleEpisode(season, ep.episode)}
                                    aria-label={seen ? t("mediaDetail.markAsUnseen") : t("mediaDetail.markAsSeen")}
                                    className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all ${seen
                                      ? "bg-yellow-600 text-white shadow-md shadow-yellow-600/30"
                                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                                      }`}
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null;

        case "cast":
          return media.credits?.cast && media.credits.cast.length > 0 ? (
            <div key="cast" className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 mb-6 shadow-sm">
              <h2 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200 mb-4">
                {t("mediaDetail.mainCast")}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {media.credits.cast.map((actor: any, index: number) => (
                  <Link
                    key={`${actor.id ?? actor.credit_id ?? actor.name ?? 'actor'}-${index}`}
                    href={`/person/${actor.id}`}
                    className="group text-center sm:text-left space-y-1"
                  >
                    <div className="relative aspect-square w-16 sm:w-20 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 mx-auto sm:mx-0">
                      {actor.profile_path ? (
                        <Image
                          src={actor.profile_path}
                          alt={actor.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          unoptimized
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-zinc-500 font-bold text-sm bg-zinc-200 dark:bg-zinc-800">
                          {actor.name.split(" ").map((n: string) => n[0]).join("")}
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-xs text-zinc-900 dark:text-zinc-50 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                      {actor.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-semibold line-clamp-1">
                      {actor.character}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null;

        case "crew":
          return media.credits?.crew && media.credits.crew.length > 0 ? (
            <div key="crew" className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 mb-6 shadow-sm">
              <h2 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200 mb-4">
                {t("mediaDetail.featuredCrew")}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {media.credits.crew.map((member: any, idx: number) => (
                  <Link
                    key={`${member.id ?? member.credit_id ?? member.name ?? 'crew'}-${idx}`}
                    href={`/person/${member.id}`}
                    className="group space-y-0.5"
                  >
                    <div className="font-bold text-xs text-zinc-900 dark:text-zinc-50 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                      {member.name}
                    </div>
                    <div className="text-[10px] text-yellow-600 dark:text-yellow-400 font-bold uppercase tracking-wider">
                      {member.job} ({member.department})
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null;

        default:
          return null;
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 flex flex-col">
      {/* Back button link */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100 self-start mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("mediaDetail.back")}
      </button>

      {/* Structured Ordered blocks */}
      <div className="space-y-2">{renderBlocks()}</div>
    </div>
  );
}
