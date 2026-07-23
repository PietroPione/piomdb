/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState } from "react";
import { unzip } from "fflate";
import {
  getCurrentUser,
  getTrackedMedia,
  getWatchedEpisodes,
  upsertTrackedMedia,
  bulkImportTrackedMedia,
  bulkImportWatchedEpisodes,
  deleteTrackedMedia,
  deleteWatchedEpisodesForMedia,
  TrackedMedia,
} from "@/lib/db";
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, FileText, FileArchive } from "lucide-react";
import { cachedFetch } from "@/lib/apiCache";
import { extractTasteProfile } from "@/lib/tasteProfile";
import { t } from "@/lib/i18n";
import { TMDB_RATE_PER_SECOND } from "@/lib/rateLimit";
import { resolveWithConcurrency } from "@/lib/concurrency";

// The server-side rate limiter (shared across all requests) is the real
// bottleneck, so the client can queue many more requests than that at once —
// they just drain at TMDB_RATE_PER_SECOND regardless of concurrency here.
const RESOLVE_CONCURRENCY = 30;
const FALLBACK_POSTER = "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=400&auto=format&fit=crop";
// Prefixes an unresolved show's raw TV Time id so it's never mistaken for a
// real TMDB id on a later import — TMDB ids are plain numbers too, unlike the
// old "tt..." IMDb ids which were self-evidently distinct from TV Time's ids.
const UNRESOLVED_PREFIX = "tvtime:";

const SHOWS_FILE = "user_tv_show_data.csv";
// tracking-prod-records-v2.csv is TV Time's real per-episode watch/rewatch log — it alone
// covers ~10x more episodes than the three small files below (verified: 7640 vs 818 on a
// real export), which only capture a partial slice. All four are kept since a differently
// shaped export might not have v2 as a strict superset; entries just dedupe into the same set.
const EPISODE_FILES = [
  { name: "seen_episode_source.csv", nameCol: "tv_show_name", seasonCol: "episode_season_number", episodeCol: "episode_number" },
  { name: "rewatched_episode.csv", nameCol: "tv_show_name", seasonCol: "episode_season_number", episodeCol: "episode_number" },
  { name: "watched_on_episode.csv", nameCol: "tv_show_name", seasonCol: "episode_season_number", episodeCol: "episode_number" },
  { name: "tracking-prod-records-v2.csv", nameCol: "series_name", seasonCol: "season_number", episodeCol: "episode_number" },
] as const;
const RECOGNIZED_FILES = [SHOWS_FILE, ...EPISODE_FILES.map((f) => f.name)];

/** Minimal CSV parser handling quoted fields (TV Time show titles can contain commas). */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] ?? "";
    });
    return obj;
  });
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}


interface ImportSummary {
  showsImported: number;
  showsResolved: number;
  episodesImported: number;
  staleCleaned: number;
}

interface ReconcileSummary {
  checked: number;
  fixed: number;
}

interface LoadableFile {
  getText: () => Promise<string>;
}

export default function TvTimeImporter() {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [fileMap, setFileMap] = useState<Record<string, LoadableFile>>({});
  const [status, setStatus] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [progressText, setProgressText] = useState("");
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [reconcileSummary, setReconcileSummary] = useState<ReconcileSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleFolderSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const matched: Record<string, LoadableFile> = {};
    for (const file of selected) {
      if (RECOGNIZED_FILES.includes(file.name)) {
        matched[file.name] = { getText: () => file.text() };
      }
    }
    setFileMap(matched);
    setStatus("idle");
    setSummary(null);
    setErrorMessage("");
  };

  const handleZipSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const zipFile = e.target.files?.[0];
    if (!zipFile) return;

    setStatus("idle");
    setSummary(null);
    setErrorMessage("");

    try {
      const buffer = new Uint8Array(await zipFile.arrayBuffer());
      const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
        unzip(
          buffer,
          { filter: (entry) => RECOGNIZED_FILES.includes(entry.name.split("/").pop() || entry.name) },
          (err, result) => (err ? reject(err) : resolve(result))
        );
      });

      const matched: Record<string, LoadableFile> = {};
      for (const [path, bytes] of Object.entries(entries)) {
        const basename = path.split("/").pop() || path;
        if (RECOGNIZED_FILES.includes(basename)) {
          matched[basename] = { getText: async () => new TextDecoder("utf-8").decode(bytes) };
        }
      }
      setFileMap(matched);
    } catch (err) {
      console.error("Failed to read zip archive:", err);
      setStatus("error");
      setErrorMessage(t("importer.zipReadError"));
    }
  };

  const handleImport = async () => {
    const showsFile = fileMap[SHOWS_FILE];
    if (!showsFile) {
      setStatus("error");
      setErrorMessage(t("importer.missingShowsFile", { file: SHOWS_FILE }));
      return;
    }

    setStatus("importing");
    setErrorMessage("");
    setReconcileSummary(null);

    try {
      const user = await getCurrentUser();
      if (!user) {
        setStatus("error");
        setErrorMessage(t("importer.mustBeAuthenticated"));
        return;
      }

      setProgressText(t("importer.readingCsv"));
      const showRows = csvToObjects(await showsFile.getText());

      // Collect every "season-episode" a show was watched in, from whichever episode-level files were provided
      const watchedByShow = new Map<string, Set<string>>();
      for (const { name, nameCol, seasonCol, episodeCol } of EPISODE_FILES) {
        const file = fileMap[name];
        if (!file) continue;
        const rows = csvToObjects(await file.getText());
        for (const row of rows) {
          const showName = row[nameCol];
          const season = row[seasonCol];
          const episode = row[episodeCol];
          if (!showName || !season || !episode) continue;
          if (!watchedByShow.has(showName)) watchedByShow.set(showName, new Set());
          watchedByShow.get(showName)!.add(`${season}-${episode}`);
        }
      }

      // Reuse TMDB ids already resolved in previous imports/seed data instead of re-querying
      const existingTracked = await getTrackedMedia(user.id);
      const existingByTitle = new Map(existingTracked.map((t) => [t.title, t]));

      const shows = showRows
        .map((row) => ({
          title: row.tv_show_name,
          tvShowId: row.tv_show_id,
          isFollowed: row.is_followed === "1",
          isFavorited: row.is_favorited === "1",
          episodesSeen: parseInt(row.nb_episodes_seen, 10) || 0,
        }))
        .filter((s) => s.title && s.tvShowId);

      let resolvedCount = 0;
      setProgressTotal(shows.length);
      setProgressCurrent(0);
      setProgressText(t("importer.resolvingTitles", { count: 0, total: shows.length }));

      const resolutions = await resolveWithConcurrency(shows, RESOLVE_CONCURRENCY, async (show) => {
        const cached = existingByTitle.get(show.title);
        let idPoster: { id: string; poster: string } | null = null;

        if (cached && !cached.media_id.startsWith(UNRESOLVED_PREFIX)) {
          idPoster = { id: cached.media_id, poster: cached.poster_path };
        } else {
          try {
            // Only cache genuine resolutions — an unresolved title (rate limit, no TMDB
            // match yet) should retry on the next import instead of getting stuck as "not found".
            idPoster = await cachedFetch(`resolve-tv-${show.title}`, async () => {
              const res = await fetch(`/api/tmdb/resolve?title=${encodeURIComponent(show.title)}&type=tv`);
              const json = await res.json();
              if (!json?.id) throw new Error("unresolved");
              return json;
            });
          } catch {
            idPoster = null;
          }
        }

        resolvedCount++;
        setProgressCurrent(resolvedCount);
        setProgressText(t("importer.resolvingTitles", { count: resolvedCount, total: shows.length }));

        if (!idPoster) return null;

        // Total episode count lets us set the correct status immediately below (fully-imported
        // shows become "Watched" right away) and feeds the DB trigger that keeps status in sync
        // for every future write. Genres/keywords feed the home page's taste-profile shelves.
        // All reused from a previous import when present instead of refetching.
        let totalEpisodes = cached?.total_episodes ?? null;
        let genres = cached?.genres ?? null;
        let keywords = cached?.keywords ?? null;
        if (!totalEpisodes || !genres) {
          try {
            const detail = await cachedFetch(`detail-v2-tv-${idPoster.id}`, async () => {
              const res = await fetch(`/api/tmdb/detail?type=tv&id=${idPoster!.id}`);
              return res.json();
            });
            totalEpisodes = totalEpisodes ?? detail?.number_of_episodes ?? null;
            const taste = extractTasteProfile(detail);
            genres = genres ?? taste.genres;
            keywords = keywords ?? taste.keywords;
          } catch {
            // keep whatever was already cached, if anything
          }
        }

        // Sampled once here (S1E1) so the profile stats page can total minutes straight
        // from the DB afterwards instead of calling TMDB itself on every load.
        let avgEpisodeRuntime = cached?.avg_episode_runtime ?? null;
        if (!avgEpisodeRuntime) {
          try {
            const season1 = await cachedFetch(`season-tv-${idPoster.id}-1`, async () => {
              const res = await fetch(`/api/tmdb/season?type=tv&id=${idPoster!.id}&season=1`);
              return res.json();
            });
            const episodes = (season1?.episodes || []) as { runtime: number | null }[];
            avgEpisodeRuntime = episodes.find((ep) => typeof ep.runtime === "number" && ep.runtime > 0)?.runtime ?? null;
          } catch {
            avgEpisodeRuntime = null;
          }
        }

        return { ...idPoster, totalEpisodes, avgEpisodeRuntime, genres, keywords };
      });

      // Different TV Time shows can resolve to the same OMDb title (e.g. regional
      // variants like "The Office" / "The Office (US)"), so dedupe by the resolved
      // key before writing — a batch upsert with duplicate keys is rejected outright.
      const trackedByKey = new Map<string, Omit<TrackedMedia, "user_id">>();
      const episodesByKey = new Map<string, { mediaId: string; season: number; episode: number }>();
      // If a title now resolves to a different id than a previous (e.g. rate-limited,
      // fallback-to-numeric-id) import wrote, the old row is stale and orphans its
      // watched episodes — clean those up so re-importing self-heals instead of accumulating dupes.
      const staleMediaIds = new Map<string, "movie" | "tv">();
      let showsResolved = 0;

      shows.forEach((show, i) => {
        const resolved = resolutions[i];
        const mediaId = resolved?.id || `${UNRESOLVED_PREFIX}${show.tvShowId}`;
        const posterPath = resolved?.poster || FALLBACK_POSTER;
        if (resolved?.id) showsResolved++;

        const cached = existingByTitle.get(show.title);
        if (cached && cached.media_id !== mediaId) {
          staleMediaIds.set(cached.media_id, cached.media_type);
        }

        const watchedSet = watchedByShow.get(show.title);
        const totalEpisodes = resolved?.totalEpisodes ?? null;
        const avgEpisodeRuntime = resolved?.avgEpisodeRuntime ?? null;
        const genres = resolved?.genres ?? null;
        const keywords = resolved?.keywords ?? null;

        // Prefer the actual imported episode completion over TV Time's own
        // is_followed/nb_episodes_seen fields, which don't reflect it (a "followed"
        // show stayed "Currently Watching" even when every episode had been imported as seen).
        let showStatus: TrackedMedia["status"] = "Want to Watch";
        if (totalEpisodes && (watchedSet?.size || 0) >= totalEpisodes) showStatus = "Watched";
        else if (show.isFollowed) showStatus = "Currently Watching";
        else if (show.episodesSeen > 0) showStatus = "Watched";

        trackedByKey.set(`tv-${mediaId}`, {
          media_id: mediaId,
          media_type: "tv",
          title: show.title,
          poster_path: posterPath,
          status: showStatus,
          is_favorite: show.isFavorited,
          user_rating: show.isFavorited ? 10 : undefined,
          total_episodes: totalEpisodes,
          avg_episode_runtime: avgEpisodeRuntime,
          genres,
          keywords,
        });

        if (watchedSet) {
          for (const key of watchedSet) {
            const [season, episode] = key.split("-").map(Number);
            episodesByKey.set(`${mediaId}-${season}-${episode}`, { mediaId, season, episode });
          }
        }
      });

      const trackedItems = Array.from(trackedByKey.values());
      const episodeEntries = Array.from(episodesByKey.values());

      setProgressText(t("importer.saving"));
      await bulkImportTrackedMedia(user.id, trackedItems);
      await bulkImportWatchedEpisodes(user.id, episodeEntries);

      if (staleMediaIds.size > 0) {
        setProgressText(t("importer.cleaningStale", { count: staleMediaIds.size }));
        await Promise.all(
          Array.from(staleMediaIds.entries()).map(([staleId, staleType]) =>
            Promise.all([
              deleteTrackedMedia(user.id, staleId, staleType),
              deleteWatchedEpisodesForMedia(user.id, staleId),
            ])
          )
        );
      }

      setSummary({
        showsImported: trackedItems.length,
        showsResolved,
        episodesImported: episodeEntries.length,
        staleCleaned: staleMediaIds.size,
      });
      setStatus("done");
    } catch (err) {
      console.error("TV Time import failed:", err);
      setStatus("error");
      setErrorMessage(t("importer.importFailed"));
    }
  };

  // One-time fix for items tracked before total_episodes/runtime/taste-profile fields
  // existed. For TV shows: status was derived from TV Time's own is_followed/nb_episodes_seen
  // fields, which don't reflect actually imported episode completion — re-checks each show
  // against TMDB and backfills total_episodes so the DB trigger keeps status correct from now
  // on. For every item (movie or show): backfills genres/keywords so the home page's
  // taste-profile shelves cover titles tracked before that existed, without a full re-import.
  const handleReconcileStatus = async () => {
    setStatus("importing");
    setErrorMessage("");
    setSummary(null);

    try {
      const user = await getCurrentUser();
      if (!user) {
        setStatus("error");
        setErrorMessage(t("importer.mustBeAuthenticated"));
        return;
      }

      const allItems = await getTrackedMedia(user.id);

      let checked = 0;
      let fixed = 0;
      setProgressTotal(allItems.length);
      setProgressCurrent(0);
      setProgressText(t("importer.checkingStatuses", { count: 0, total: allItems.length }));

      await resolveWithConcurrency(allItems, RESOLVE_CONCURRENCY, async (item) => {
        try {
          const detail = await cachedFetch(`detail-v2-${item.media_type}-${item.media_id}`, async () => {
            const res = await fetch(`/api/tmdb/detail?type=${item.media_type}&id=${item.media_id}`);
            return res.json();
          });

          const taste = extractTasteProfile(detail);
          const genres = item.genres ?? taste.genres;
          const keywords = item.keywords ?? taste.keywords;

          if (item.media_type === "movie") {
            const runtime = item.runtime ?? detail?.runtime ?? null;
            const needsUpdate = (runtime && runtime !== item.runtime) || genres !== item.genres || keywords !== item.keywords;
            if (needsUpdate) {
              await upsertTrackedMedia(user.id, {
                media_id: item.media_id,
                media_type: "movie",
                title: item.title,
                poster_path: item.poster_path,
                status: item.status,
                user_rating: item.user_rating,
                is_favorite: item.is_favorite,
                runtime,
                genres,
                keywords,
              });
            }
            return;
          }

          const total: number | null = detail?.number_of_episodes ?? null;

          // Backfills shows tracked before avg_episode_runtime existed, so the profile
          // stats page can read it straight from the DB without ever calling TMDB itself.
          let avgEpisodeRuntime = item.avg_episode_runtime ?? null;
          if (!avgEpisodeRuntime) {
            const season1 = await cachedFetch(`season-tv-${item.media_id}-1`, async () => {
              const res = await fetch(`/api/tmdb/season?type=tv&id=${item.media_id}&season=1`);
              return res.json();
            });
            const episodes = (season1?.episodes || []) as { runtime: number | null }[];
            avgEpisodeRuntime = episodes.find((ep) => typeof ep.runtime === "number" && ep.runtime > 0)?.runtime ?? null;
          }

          const needsUpdate = (total && total !== item.total_episodes)
            || (avgEpisodeRuntime && avgEpisodeRuntime !== item.avg_episode_runtime)
            || genres !== item.genres || keywords !== item.keywords;

          if (needsUpdate) {
            const watched = await getWatchedEpisodes(user.id, item.media_id);
            const nowWatched = !!total && watched.length >= total;
            await upsertTrackedMedia(user.id, {
              media_id: item.media_id,
              media_type: "tv",
              title: item.title,
              poster_path: item.poster_path,
              status: nowWatched ? "Watched" : item.status,
              user_rating: item.user_rating,
              is_favorite: item.is_favorite,
              total_episodes: total,
              avg_episode_runtime: avgEpisodeRuntime,
              genres,
              keywords,
            });
            if (nowWatched && item.status !== "Watched") fixed++;
          }
        } catch (err) {
          console.error(`Failed reconciling ${item.title}:`, err);
        } finally {
          checked++;
          setProgressCurrent(checked);
          setProgressText(t("importer.checkingStatuses", { count: checked, total: allItems.length }));
        }
      });

      setReconcileSummary({ checked: allItems.length, fixed });
      setStatus("done");
    } catch (err) {
      console.error("Status reconciliation failed:", err);
      setStatus("error");
      setErrorMessage(t("importer.importFailed"));
    }
  };

  const recognizedCount = Object.keys(fileMap).length;
  const etaSeconds = Math.max(0, Math.ceil((progressTotal - progressCurrent) / TMDB_RATE_PER_SECOND));
  const progressPercent = progressTotal > 0 ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100)) : 0;

  return (
    <>
    <section className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200/60 dark:border-zinc-800">
      <h2 className="text-lg font-black tracking-tight text-zinc-800 dark:text-zinc-200 mb-1 flex items-center gap-2">
        <UploadCloud className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        {t("importer.title")}
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
        {t("importer.description")}
      </p>

      <input
        ref={zipInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleZipSelected}
      />

      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept=".csv"
        className="hidden"
        onChange={handleFolderSelected}
        {...({ webkitdirectory: "" } as any)}
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => zipInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition-colors"
        >
          <FileArchive className="h-3.5 w-3.5" />
          {t("importer.selectZip")}
        </button>

        <button
          onClick={() => folderInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          {t("importer.selectFolder")}
        </button>

        <button
          onClick={handleImport}
          disabled={recognizedCount === 0 || status === "importing"}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
        >
          {status === "importing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("importer.import")}
        </button>

        <button
          onClick={handleReconcileStatus}
          disabled={status === "importing"}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors"
        >
          {t("importer.checkStatuses")}
        </button>
      </div>

      {recognizedCount > 0 && status !== "done" && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {RECOGNIZED_FILES.map((name) => (
            <span
              key={name}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                fileMap[name]
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/20"
                  : "bg-zinc-50 text-zinc-400 border-zinc-100 dark:bg-zinc-950/30 dark:border-zinc-800"
              }`}
            >
              {fileMap[name] ? "✓" : "—"} {name}
            </span>
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {errorMessage}
        </div>
      )}

      {status === "done" && summary && (
        <div className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="font-semibold">
            {t("importer.summary", { shows: summary.showsImported, resolved: summary.showsResolved, episodes: summary.episodesImported })}
            {summary.staleCleaned > 0 && t("importer.summaryStale", { count: summary.staleCleaned })}
          </div>
        </div>
      )}

      {status === "done" && reconcileSummary && (
        <div className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="font-semibold">
            {t("importer.reconcileSummary", { checked: reconcileSummary.checked, fixed: reconcileSummary.fixed })}
          </div>
        </div>
      )}
    </section>

    {status === "importing" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-200/60 dark:border-zinc-800 text-center space-y-4">
          <Loader2 className="h-8 w-8 text-yellow-600 dark:text-yellow-400 animate-spin mx-auto" />
          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{progressText}</p>
          {progressTotal > 0 && (
            <>
              <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-yellow-600 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">
                {t("importer.etaRemaining", { time: formatEta(etaSeconds) })}
              </p>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}
