/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser, getTrackedMedia, deleteTrackedMedia, upsertTrackedMedia, TrackedMedia } from "@/lib/db";
import { Bookmark, Star, Trash2, Edit3, Heart, LayoutGrid, ListPlus, Play, CheckCheck, PauseCircle } from "lucide-react";
import { t } from "@/lib/i18n";

const WATCH_STATUS_CATEGORIES = [
  "Want to Watch",
  "Currently Watching",
  "Watched",
  "On Hold",
] as const;

const STATUS_ICONS: Record<typeof WATCH_STATUS_CATEGORIES[number], typeof Play> = {
  "Want to Watch": ListPlus,
  "Currently Watching": Play,
  "Watched": CheckCheck,
  "On Hold": PauseCircle,
};

export default function Watchlist() {
  const [user, setUser] = useState<any>(null);
  const [tracked, setTracked] = useState<TrackedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<typeof WATCH_STATUS_CATEGORIES[number] | "All" | "Favorites">("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState<number>(10);
  const [editStatus, setEditStatus] = useState<TrackedMedia["status"]>("Watched");
  const [editFavorite, setEditFavorite] = useState<boolean>(false);

  const loadTracked = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        const data = await getTrackedMedia(currentUser.id);
        setTracked(data);
      }
    } catch (err) {
      console.error("Failed to load tracking data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracked();
  }, []);

  const handleDelete = async (mediaId: string, mediaType: "movie" | "tv") => {
    if (!user) return;
    const ok = await deleteTrackedMedia(user.id, mediaId, mediaType);
    if (ok) {
      setTracked(tracked.filter(item => !(item.media_id === mediaId && item.media_type === mediaType)));
    }
  };

  const handleUpdate = async (item: TrackedMedia) => {
    if (!user) return;
    const updated = await upsertTrackedMedia(user.id, {
      media_id: item.media_id,
      media_type: item.media_type,
      title: item.title,
      poster_path: item.poster_path,
      status: editStatus,
      user_rating: editRating,
      is_favorite: editFavorite,
    });

    if (updated) {
      setEditingId(null);
      loadTracked();
    }
  };

  const startEdit = (item: TrackedMedia) => {
    setEditingId(`${item.media_type}-${item.media_id}`);
    setEditRating(item.user_rating || 10);
    setEditStatus(item.status);
    setEditFavorite(item.is_favorite || false);
  };

  const filteredItems = activeTab === "All"
    ? tracked
    : activeTab === "Favorites"
      ? tracked.filter(item => item.is_favorite)
      : tracked.filter(item => item.status === activeTab);

  if (!user && !loading) {
    return (
      <div className="max-w-md mx-auto my-20 px-6 text-center">
        <div className="h-16 w-16 bg-yellow-50 dark:bg-zinc-900 text-yellow-600 dark:text-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-yellow-100/30 dark:border-zinc-800">
          <Bookmark className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{t("watchlist.signInRequiredTitle")}</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 max-w-sm mx-auto">
          {t("watchlist.signInRequiredBody")}
        </p>
        <Link
          href="/login"
          className="inline-flex w-full justify-center bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-3 px-4 rounded-xl mt-6 shadow-md transition-all"
        >
          {t("watchlist.signInNow")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 flex-1 flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">{t("watchlist.title")}</h1>
        <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm mt-1">
          {t("watchlist.subtitle")}
        </p>
      </div>

      {/* Status filter buttons */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        <button
          onClick={() => setActiveTab("All")}
          className={`flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl border transition-all ${
            activeTab === "All"
              ? "bg-yellow-600 border-yellow-600 text-white shadow-lg shadow-yellow-600/20"
              : "bg-white dark:bg-zinc-900 border-zinc-200/60 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-yellow-300 dark:hover:border-yellow-800"
          }`}
        >
          <LayoutGrid className="h-5 w-5" />
          <span className="text-xxs font-bold uppercase tracking-wider">{t("watchlist.all")}</span>
          <span className={`text-lg font-black ${activeTab === "All" ? "text-white" : "text-zinc-900 dark:text-zinc-50"}`}>
            {tracked.length}
          </span>
        </button>

        {WATCH_STATUS_CATEGORIES.map(cat => {
          const count = tracked.filter(t => t.status === cat).length;
          const Icon = STATUS_ICONS[cat];
          const isActive = activeTab === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl border transition-all ${
                isActive
                  ? "bg-yellow-600 border-yellow-600 text-white shadow-lg shadow-yellow-600/20"
                  : "bg-white dark:bg-zinc-900 border-zinc-200/60 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-yellow-300 dark:hover:border-yellow-800"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xxs font-bold uppercase tracking-wider text-center">{t(`status.${cat}`)}</span>
              <span className={`text-lg font-black ${isActive ? "text-white" : "text-zinc-900 dark:text-zinc-50"}`}>
                {count}
              </span>
            </button>
          );
        })}

        {/* Favorites is a separate tag, not a watch-progress stage - kept visually apart with a pink accent */}
        <button
          onClick={() => setActiveTab("Favorites")}
          className={`flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl border transition-all ${
            activeTab === "Favorites"
              ? "bg-pink-600 border-pink-600 text-white shadow-lg shadow-pink-600/20"
              : "bg-white dark:bg-zinc-900 border-zinc-200/60 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-pink-300 dark:hover:border-pink-800"
          }`}
        >
          <Heart className={`h-5 w-5 ${activeTab === "Favorites" ? "fill-current" : ""}`} />
          <span className="text-xxs font-bold uppercase tracking-wider">{t("watchlist.favorites")}</span>
          <span className={`text-lg font-black ${activeTab === "Favorites" ? "text-white" : "text-zinc-900 dark:text-zinc-50"}`}>
            {tracked.filter(t => t.is_favorite).length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 flex-1">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-yellow-600 border-t-transparent" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-zinc-900/40 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 flex-1">
          <Bookmark className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-4" />
          <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-200">{t("watchlist.emptyTitle")}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mt-1">
            {t("watchlist.emptyBody", {
              category: activeTab === "All" ? t("watchlist.all") : activeTab === "Favorites" ? t("watchlist.favorites") : t(`status.${activeTab}`)
            })}
          </p>
          <Link
            href="/discover"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-yellow-400 text-xs font-bold mt-4 transition-colors"
          >
            {t("watchlist.findShowsMovies")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredItems.map(item => {
            const isEditing = editingId === `${item.media_type}-${item.media_id}`;
            return (
              <div
                key={`${item.media_type}-${item.media_id}`}
                className="flex bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm overflow-hidden transition-all hover:shadow-md"
              >
                {/* Poster section */}
                <div className="relative w-32 aspect-[2/3] flex-shrink-0 bg-zinc-100 dark:bg-zinc-800">
                  <Image
                    src={item.poster_path}
                    alt={item.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute top-2 left-2 bg-zinc-950/80 backdrop-blur-sm text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase">
                    {t(`mediaType.${item.media_type}`)}
                  </div>
                </div>

                {/* Info section */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <Link
                        href={`/media/${item.media_type}/${item.media_id}`}
                        className="font-bold text-zinc-900 dark:text-zinc-50 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors line-clamp-1 text-base"
                      >
                        {item.title}
                      </Link>
                      <button
                        onClick={() => handleDelete(item.media_id, item.media_type)}
                        className="text-zinc-400 hover:text-red-500 p-1 rounded-lg transition-colors"
                        title={t("watchlist.removeTracking")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap gap-1.5 items-center mt-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-yellow-50 text-yellow-600 dark:bg-yellow-950/30 dark:text-yellow-400 border border-yellow-100/30 dark:border-yellow-900/20">
                        {t(`status.${item.status}`)}
                      </span>
                      {item.is_favorite && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400 border border-pink-100/30 dark:border-pink-900/20">
                          <Heart className="h-3 w-3 fill-current" />
                          {t("watchlist.favorite")}
                        </span>
                      )}
                      {item.user_rating && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100/30 dark:border-amber-900/20">
                          <Star className="h-3 w-3 fill-current text-amber-500" />
                          {item.user_rating}/10
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Edit interface overlay or drawer */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{t("watchlist.statusLabel")}</label>
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value as TrackedMedia["status"])}
                              className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-yellow-500"
                            >
                              {WATCH_STATUS_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{t(`status.${cat}`)}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{t("watchlist.ratingLabel")}</label>
                            <select
                              value={editRating}
                              onChange={(e) => setEditRating(parseInt(e.target.value, 10))}
                              className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-yellow-500"
                            >
                              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(r => (
                                <option key={r} value={r}>{r}/10</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={() => setEditFavorite(!editFavorite)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xxs font-bold transition-colors ${
                            editFavorite
                              ? "bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                          }`}
                        >
                          <Heart className={`h-3 w-3 ${editFavorite ? "fill-current" : ""}`} />
                          {editFavorite ? t("watchlist.favorited") : t("watchlist.markAsFavorite")}
                        </button>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 text-xxs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                          >
                            {t("watchlist.cancel")}
                          </button>
                          <button
                            onClick={() => handleUpdate(item)}
                            className="px-2.5 py-1 text-xxs font-bold bg-yellow-600 hover:bg-yellow-500 text-white rounded-md transition-colors"
                          >
                            {t("watchlist.save")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(item)}
                        className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400 font-semibold hover:underline"
                      >
                        <Edit3 className="h-3 w-3" />
                        {t("watchlist.editReviewStatus")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
