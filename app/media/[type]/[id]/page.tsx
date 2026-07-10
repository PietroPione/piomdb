/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DETAIL_LAYOUT_CONFIG } from "@/config/detailLayout";
import { getCurrentUser, getTrackedMedia, upsertTrackedMedia, deleteTrackedMedia, TrackedMedia } from "@/lib/db";
import { ChevronLeft, Star, Film, Tv, AlertCircle } from "lucide-react";

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

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load User
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        // Fetch Detail info from Secure API Route
        const detailRes = await fetch(`/api/tmdb/detail?type=${mediaType}&id=${id}`);
        if (!detailRes.ok) throw new Error("Could not load media details");
        const detailData = await detailRes.json();
        setMedia(detailData);

        // Fetch User's Tracking State if authenticated
        if (currentUser) {
          const trackedList = await getTrackedMedia(currentUser.id);
          const matched = trackedList.find(
            (item) => item.media_id === parseInt(id, 10) && item.media_type === mediaType
          );
          if (matched) setTrackingState(matched);
        }
      } catch (err) {
        console.error("Failed loading media:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, mediaType]);

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
      };

      const result = await upsertTrackedMedia(user.id, payload);
      if (result) {
        setTrackingState(result);
      }
    } catch (err) {
      console.error("Failed saving tracking state:", err);
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-solid border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!media) {
    return (
      <div className="max-w-md mx-auto my-20 text-center px-6">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Media Not Found</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          We could not load details for this title. Please try again.
        </p>
        <Link href="/discover" className="inline-block mt-4 text-indigo-600 font-semibold hover:underline text-sm">
          Return to Discover
        </Link>
      </div>
    );
  }

  // Render customizable blocks by ordering layout items configured in config/detailLayout.ts
  const renderBlocks = () => {
    return DETAIL_LAYOUT_CONFIG.filter((b) => b.enabled).map((block) => {
      switch (block.id) {
        case "header":
          return (
            <div key="header" className="relative bg-zinc-900 text-white rounded-3xl overflow-hidden shadow-2xl mb-10">
              {/* Backdrop Background with Overlay */}
              <div className="absolute inset-0 aspect-[21/9] w-full">
                <Image
                  src={media.backdrop_path}
                  alt={media.title}
                  fill
                  className="object-cover opacity-25 filter blur-sm"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-900/80 to-transparent" />
              </div>

              {/* Header Content */}
              <div className="relative z-10 px-6 sm:px-12 py-12 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left mt-12">
                {/* Poster image */}
                <div className="relative w-48 sm:w-56 aspect-[2/3] rounded-2xl overflow-hidden shadow-xl bg-zinc-800 flex-shrink-0">
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
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300">
                    {mediaType === "movie" ? (
                      <Film className="h-3.5 w-3.5" />
                    ) : (
                      <Tv className="h-3.5 w-3.5" />
                    )}
                    {mediaType === "movie" ? "Movie" : "TV Show"}
                  </span>

                  <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none text-zinc-50">
                    {media.title}
                  </h1>

                  {media.tagline && (
                    <p className="text-indigo-200 text-sm sm:text-base italic font-medium leading-relaxed">
                      &ldquo;{media.tagline}&rdquo;
                    </p>
                  )}

                  {/* Tracking Widget Panel */}
                  <div className="bg-zinc-950/60 p-4 sm:p-5 rounded-2xl border border-zinc-800/80 backdrop-blur-md inline-block text-left w-full max-w-lg mt-6">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">
                      My Review & Track Status
                    </h3>

                    {!user ? (
                      <div>
                        <p className="text-xs text-zinc-300 font-medium">
                          You must be signed in to rate or save this title.
                        </p>
                        <Link
                          href="/login"
                          className="inline-block mt-3 text-xs font-bold text-indigo-400 hover:underline"
                        >
                          Sign In or Sign Up &rarr;
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {(["Currently Watching", "Want to Watch", "Watched", "On Hold", "Favorites"] as const).map((status) => {
                            const isCurrent = trackingState?.status === status;
                            return (
                              <button
                                key={status}
                                disabled={saving}
                                onClick={() => handleTrack(status)}
                                className={`px-3 py-1.5 rounded-lg text-xxs font-bold uppercase tracking-wider transition-all ${
                                  isCurrent
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                                    : "bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300"
                                }`}
                              >
                                {status}
                              </button>
                            );
                          })}
                        </div>

                        {trackingState && (
                          <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-800/60">
                            {/* Star Rating Widget */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-zinc-300">My Rating:</span>
                              <select
                                disabled={saving}
                                value={trackingState.user_rating || ""}
                                onChange={(e) => handleRate(parseInt(e.target.value, 10))}
                                className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg p-1 font-bold focus:outline-none"
                              >
                                <option value="" disabled>Rate</option>
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
                              Remove tracking
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
                    {media.vote_average.toFixed(1)}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold">/10</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                  {media.vote_count.toLocaleString()} TMDB community votes
                </div>
              </div>
            </div>
          );

        case "genres":
          return (
            <div key="genres" className="flex flex-wrap gap-2 mb-6">
              {media.genres.map((g: any) => (
                <span
                  key={g.id}
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
                Synopsis
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm font-medium">
                {media.overview || "No overview available for this title."}
              </p>
            </div>
          );

        case "metadata":
          return (
            <div key="metadata" className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                <span className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                  Status
                </span>
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                  {media.status}
                </span>
              </div>

              {media.release_date && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                  <span className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                    Release Date
                  </span>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    {new Date(media.release_date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}

              {media.runtime && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                  <span className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                    Runtime
                  </span>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    {media.runtime} minutes
                  </span>
                </div>
              )}

              {mediaType === "tv" && media.number_of_seasons && (
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                  <span className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                    Seasons
                  </span>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                    {media.number_of_seasons} seasons ({media.number_of_episodes} eps)
                  </span>
                </div>
              )}
            </div>
          );

        case "cast":
          return media.credits?.cast && media.credits.cast.length > 0 ? (
            <div key="cast" className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 mb-6 shadow-sm">
              <h2 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200 mb-4">
                Main Cast
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {media.credits.cast.map((actor: any) => (
                  <div key={actor.id} className="text-center sm:text-left space-y-1">
                    <div className="relative aspect-square w-16 sm:w-20 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 mx-auto sm:mx-0">
                      {actor.profile_path ? (
                        <Image
                          src={actor.profile_path}
                          alt={actor.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-zinc-500 font-bold text-sm bg-zinc-200 dark:bg-zinc-800">
                          {actor.name.split(" ").map((n: string) => n[0]).join("")}
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-xs text-zinc-900 dark:text-zinc-50">
                      {actor.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-semibold line-clamp-1">
                      {actor.character}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null;

        case "crew":
          return media.credits?.crew && media.credits.crew.length > 0 ? (
            <div key="crew" className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 mb-6 shadow-sm">
              <h2 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200 mb-4">
                Featured Crew
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {media.credits.crew.map((member: any, idx: number) => (
                  <div key={`${member.id}-${idx}`} className="space-y-0.5">
                    <div className="font-bold text-xs text-zinc-900 dark:text-zinc-50">
                      {member.name}
                    </div>
                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
                      {member.job} ({member.department})
                    </div>
                  </div>
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
        Back
      </button>

      {/* Structured Ordered blocks */}
      <div className="space-y-2">{renderBlocks()}</div>
    </div>
  );
}
