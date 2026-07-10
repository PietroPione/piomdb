/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser, getTrackedMedia, deleteTrackedMedia, upsertTrackedMedia, TrackedMedia } from "@/lib/db";
import { Bookmark, Star, Trash2, Edit3 } from "lucide-react";

const WATCH_STATUS_CATEGORIES = [
  "Currently Watching",
  "Want to Watch",
  "Watched",
  "On Hold",
  "Favorites",
] as const;

export default function Watchlist() {
  const [user, setUser] = useState<any>(null);
  const [tracked, setTracked] = useState<TrackedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<typeof WATCH_STATUS_CATEGORIES[number] | "All">("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState<number>(10);
  const [editStatus, setEditStatus] = useState<TrackedMedia["status"]>("Watched");

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

  const handleDelete = async (mediaId: number, mediaType: "movie" | "tv") => {
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
  };

  const filteredItems = activeTab === "All"
    ? tracked
    : tracked.filter(item => item.status === activeTab);

  if (!user && !loading) {
    return (
      <div className="max-w-md mx-auto my-20 px-6 text-center">
        <div className="h-16 w-16 bg-indigo-50 dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-100/30 dark:border-zinc-800">
          <Bookmark className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Sync Across All Devices</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 max-w-sm mx-auto">
          Sign up or log in to create your personal tracking dashboard, rate media, and keep track of your watch history.
        </p>
        <Link
          href="/login"
          className="inline-flex w-full justify-center bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl mt-6 shadow-md transition-all"
        >
          Sign In Now
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 flex-1 flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight">My Watchlist</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm mt-1">
            Manage your personal library, track your progress, and edit your review ratings.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap gap-2 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800 self-start">
          <button
            onClick={() => setActiveTab("All")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "All"
                ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            All ({tracked.length})
          </button>
          {WATCH_STATUS_CATEGORIES.map(cat => {
            const count = tracked.filter(t => t.status === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === cat
                    ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 flex-1">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-t-transparent" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-zinc-900/40 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 flex-1">
          <Bookmark className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-4" />
          <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-200">Empty list</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mt-1">
            No items found in category &quot;{activeTab}&quot;. Head over to discover to search and add titles.
          </p>
          <Link
            href="/discover"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-indigo-400 text-xs font-bold mt-4 transition-colors"
          >
            Find Shows & Movies
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
                    {item.media_type}
                  </div>
                </div>

                {/* Info section */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <Link
                        href={`/media/${item.media_type}/${item.media_id}`}
                        className="font-bold text-zinc-900 dark:text-zinc-50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1 text-base"
                      >
                        {item.title}
                      </Link>
                      <button
                        onClick={() => handleDelete(item.media_id, item.media_type)}
                        className="text-zinc-400 hover:text-red-500 p-1 rounded-lg transition-colors"
                        title="Remove tracking"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap gap-1.5 items-center mt-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/20">
                        {item.status}
                      </span>
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
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Status</label>
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value as TrackedMedia["status"])}
                              className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              {WATCH_STATUS_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Rating</label>
                            <select
                              value={editRating}
                              onChange={(e) => setEditRating(parseInt(e.target.value, 10))}
                              className="w-full text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(r => (
                                <option key={r} value={r}>{r}/10</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 text-xxs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdate(item)}
                            className="px-2.5 py-1 text-xxs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(item)}
                        className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                      >
                        <Edit3 className="h-3 w-3" />
                        Edit review status
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
