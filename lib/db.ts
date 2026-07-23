/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { createClient } from '@supabase/supabase-js';
import { loadTVTimeUser, loadTVTimeTrackedMedia } from './tvtime';

// Setup Supabase Client dynamically
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Supabase renamed the legacy "anon key" to "publishable key"; accept either.
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

// Check if we have valid Supabase keys to use
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Tracked item types
export interface TrackedMedia {
  id?: string;
  user_id?: string;
  media_id: string;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string;
  status: 'Watched' | 'Want to Watch' | 'Currently Watching' | 'On Hold';
  is_favorite?: boolean;
  user_rating?: number; // User rating out of 10
  total_episodes?: number | null; // TV only — lets a DB trigger auto-flip status to Watched
  runtime?: number | null; // Movie only — minutes, used for profile stats totals
  avg_episode_runtime?: number | null; // TV only — sampled S1E1 runtime, used for profile stats totals
  genres?: { id: number; name: string }[] | null; // Taste profile — feeds home genre shelf
  keywords?: { id: number; name: string }[] | null; // Themes/tags — feeds home theme shelf
  updated_at?: string;
}

// User Profile state types
export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  created_at?: string;
}

// Global active session state for Mock Mode (safely runs client-side only)
let mockUser: UserProfile | null = null;

// Load initial mock user from TV Time export on server/client fallback
const defaultTVTimeUser = loadTVTimeUser() || {
  id: "11519429",
  email: "pietrofranchitti@hotmail.it",
  username: "Pietrolone",
  created_at: "2017-02-22 12:54:19"
};

if (typeof window !== 'undefined') {
  const storedUser = localStorage.getItem('piomdb_mock_user');
  if (storedUser) {
    try {
      mockUser = JSON.parse(storedUser);
    } catch (_) {}
  } else {
    // Default to the imported TV Time user Pietrolone so they don't have to register!
    mockUser = defaultTVTimeUser;
    localStorage.setItem('piomdb_mock_user', JSON.stringify(mockUser));
  }
}

/**
 * AUTHENTICATION LAYER
 */

export async function getCurrentUser(): Promise<UserProfile | null> {
  if (isSupabaseConfigured && supabase) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return {
      id: user.id,
      email: user.email || '',
      username: user.user_metadata?.username || user.email?.split('@')[0],
    };
  }

  // Fallback to local storage mock user or default imported TV Time user
  return mockUser || defaultTVTimeUser;
}

export async function signUpUser(email: string, password: string, username?: string): Promise<{ user: UserProfile | null; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || email.split('@')[0],
        },
      },
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (data.user) {
      // Upsert profile row
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email || '',
        username: username || data.user.email?.split('@')[0],
      });

      return {
        user: {
          id: data.user.id,
          email: data.user.email || '',
          username: username || data.user.email?.split('@')[0],
        },
        error: null,
      };
    }
    return { user: null, error: 'Registration incomplete.' };
  }

  // Local Storage Mock Authentication
  if (typeof window !== 'undefined') {
    const mockUsers = JSON.parse(localStorage.getItem('piomdb_mock_users') || '[]');
    if (mockUsers.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
      return { user: null, error: 'User already exists.' };
    }

    const newUser: UserProfile = {
      id: `usr_${Math.random().toString(36).substr(2, 9)}`,
      email,
      username: username || email.split('@')[0],
      created_at: new Date().toISOString(),
    };

    mockUsers.push({ ...newUser, password });
    localStorage.setItem('piomdb_mock_users', JSON.stringify(mockUsers));
    localStorage.setItem('piomdb_mock_user', JSON.stringify(newUser));
    mockUser = newUser;

    // Trigger standard auth change event to components
    window.dispatchEvent(new Event('storage'));

    return { user: newUser, error: null };
  }

  return { user: null, error: 'No browser window detected.' };
}

export async function signInUser(email: string, password: string): Promise<{ user: UserProfile | null; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { user: null, error: error.message };
    if (data.user) {
      return {
        user: {
          id: data.user.id,
          email: data.user.email || '',
          username: data.user.user_metadata?.username || data.user.email?.split('@')[0],
        },
        error: null,
      };
    }
  }

  // Local Storage Mock Sign In
  if (typeof window !== 'undefined') {
    const mockUsers = JSON.parse(localStorage.getItem('piomdb_mock_users') || '[]');
    const matched = mockUsers.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!matched) {
      // Also allow logging in directly as Pietrolone with the right email!
      if (email.toLowerCase() === defaultTVTimeUser.email.toLowerCase()) {
        const authenticatedUser = defaultTVTimeUser;
        localStorage.setItem('piomdb_mock_user', JSON.stringify(authenticatedUser));
        mockUser = authenticatedUser;
        window.dispatchEvent(new Event('storage'));
        return { user: authenticatedUser, error: null };
      }
      return { user: null, error: 'Invalid email or password.' };
    }

    const authenticatedUser: UserProfile = {
      id: matched.id,
      email: matched.email,
      username: matched.username,
      created_at: matched.created_at,
    };

    localStorage.setItem('piomdb_mock_user', JSON.stringify(authenticatedUser));
    mockUser = authenticatedUser;

    // Trigger standard auth change event
    window.dispatchEvent(new Event('storage'));

    return { user: authenticatedUser, error: null };
  }

  return { user: null, error: 'No browser window detected.' };
}

export async function signOutUser(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
    return;
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem('piomdb_mock_user');
    mockUser = null;
    window.dispatchEvent(new Event('storage'));
  }
}


/**
 * EPISODE TRACKING LAYER
 */

export interface WatchedEpisode {
  user_id: string;
  media_id: string;
  season: number;
  episode: number;
  updated_at?: string;
}

const WATCHED_EPISODES_KEY = 'piomdb_watched_episodes';

function readWatchedEpisodes(): WatchedEpisode[] {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem(WATCHED_EPISODES_KEY) || '[]');
}

function writeWatchedEpisodes(entries: WatchedEpisode[]): void {
  localStorage.setItem(WATCHED_EPISODES_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event('storage'));
}

export async function getWatchedEpisodes(userId: string, mediaId: string): Promise<WatchedEpisode[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('watched_episodes')
      .select('*')
      .eq('user_id', userId)
      .eq('media_id', mediaId);

    if (error) {
      console.error('Error fetching watched episodes from Supabase:', error);
      return [];
    }
    return data || [];
  }

  return readWatchedEpisodes().filter((e) => e.user_id === userId && e.media_id === mediaId);
}

export async function getWatchedEpisodeCountsByMedia(userId: string): Promise<Record<string, number>> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('watched_episodes')
      .select('media_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching watched episode counts from Supabase:', error);
      return {};
    }
    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.media_id] = (counts[row.media_id] || 0) + 1;
    }
    return counts;
  }

  const counts: Record<string, number> = {};
  for (const entry of readWatchedEpisodes()) {
    if (entry.user_id !== userId) continue;
    counts[entry.media_id] = (counts[entry.media_id] || 0) + 1;
  }
  return counts;
}

export async function setEpisodeWatched(
  userId: string,
  mediaId: string,
  season: number,
  episode: number,
  watched: boolean
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    if (watched) {
      const { error } = await supabase
        .from('watched_episodes')
        .upsert(
          { user_id: userId, media_id: mediaId, season, episode, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,media_id,season,episode' }
        );
      if (error) console.error('Error upserting watched episode to Supabase:', error);
    } else {
      const { error } = await supabase
        .from('watched_episodes')
        .delete()
        .eq('user_id', userId)
        .eq('media_id', mediaId)
        .eq('season', season)
        .eq('episode', episode);
      if (error) console.error('Error deleting watched episode from Supabase:', error);
    }
    return;
  }

  if (typeof window === 'undefined') return;
  const all = readWatchedEpisodes();
  const idx = all.findIndex(
    (e) => e.user_id === userId && e.media_id === mediaId && e.season === season && e.episode === episode
  );

  if (watched) {
    const entry: WatchedEpisode = { user_id: userId, media_id: mediaId, season, episode, updated_at: new Date().toISOString() };
    if (idx >= 0) all[idx] = entry;
    else all.push(entry);
  } else if (idx >= 0) {
    all.splice(idx, 1);
  }

  writeWatchedEpisodes(all);
}

export async function setSeasonWatched(
  userId: string,
  mediaId: string,
  season: number,
  episodeNumbers: number[],
  watched: boolean
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    if (watched) {
      const now = new Date().toISOString();
      const rows = episodeNumbers.map((episode) => ({ user_id: userId, media_id: mediaId, season, episode, updated_at: now }));
      const { error } = await supabase.from('watched_episodes').upsert(rows, { onConflict: 'user_id,media_id,season,episode' });
      if (error) console.error('Error upserting season to Supabase:', error);
    } else {
      const { error } = await supabase
        .from('watched_episodes')
        .delete()
        .eq('user_id', userId)
        .eq('media_id', mediaId)
        .eq('season', season);
      if (error) console.error('Error deleting season from Supabase:', error);
    }
    return;
  }

  if (typeof window === 'undefined') return;
  const remaining = readWatchedEpisodes().filter(
    (e) => !(e.user_id === userId && e.media_id === mediaId && e.season === season)
  );

  if (watched) {
    const now = new Date().toISOString();
    for (const episode of episodeNumbers) {
      remaining.push({ user_id: userId, media_id: mediaId, season, episode, updated_at: now });
    }
  }

  writeWatchedEpisodes(remaining);
}

/** Bulk-write watched episodes (e.g. from a CSV import) in a single write. */
export async function bulkImportWatchedEpisodes(
  userId: string,
  entries: { mediaId: string; season: number; episode: number }[]
): Promise<void> {
  if (entries.length === 0) return;

  if (isSupabaseConfigured && supabase) {
    const now = new Date().toISOString();
    const rows = entries.map((e) => ({ user_id: userId, media_id: e.mediaId, season: e.season, episode: e.episode, updated_at: now }));
    const { error } = await supabase.from('watched_episodes').upsert(rows, { onConflict: 'user_id,media_id,season,episode' });
    if (error) {
      console.error('Error bulk-importing watched episodes to Supabase:', error);
      throw error;
    }
    return;
  }

  if (typeof window === 'undefined') return;
  const existing = readWatchedEpisodes();
  const existingKeys = new Set(existing.map((e) => `${e.user_id}-${e.media_id}-${e.season}-${e.episode}`));
  const now = new Date().toISOString();

  for (const entry of entries) {
    const key = `${userId}-${entry.mediaId}-${entry.season}-${entry.episode}`;
    if (!existingKeys.has(key)) {
      existing.push({ user_id: userId, media_id: entry.mediaId, season: entry.season, episode: entry.episode, updated_at: now });
      existingKeys.add(key);
    }
  }

  writeWatchedEpisodes(existing);
}

/** Deletes all watched-episode rows for a given media item (e.g. cleaning up a stale id after re-resolution). */
export async function deleteWatchedEpisodesForMedia(userId: string, mediaId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('watched_episodes').delete().eq('user_id', userId).eq('media_id', mediaId);
    if (error) {
      console.error('Error deleting stale watched episodes from Supabase:', error);
      throw error;
    }
    return;
  }

  if (typeof window === 'undefined') return;
  writeWatchedEpisodes(readWatchedEpisodes().filter((e) => !(e.user_id === userId && e.media_id === mediaId)));
}

/**
 * DATABASE / MEDIA TRACKING LAYER
 */

export async function getTrackedMedia(userId: string): Promise<TrackedMedia[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('tracked_media')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching tracked media from Supabase:', error);
      return [];
    }
    return data || [];
  }

  // Fallback Mock Database load from CSV and local storage edits
  // 1. Load the TV Time base list
  const tvtimeBaseList = loadTVTimeTrackedMedia(userId);

  // 2. Load local edits/additions made by the user in mock mode
  if (typeof window !== 'undefined') {
    const userEdits = JSON.parse(localStorage.getItem('piomdb_tracked_media') || '[]');
    const userMockEdits = userEdits.filter((item: TrackedMedia) => item.user_id === userId);

    // Merge edits: user local changes override or add to TV Time base data
    const mergedMap = new Map<string, TrackedMedia>();

    // Add TV Time base list items
    tvtimeBaseList.forEach((item) => {
      const key = `${item.media_type}-${item.media_id}`;
      mergedMap.set(key, item);
    });

    // Merge/overwrite with user local edits
    userMockEdits.forEach((item: TrackedMedia) => {
      const key = `${item.media_type}-${item.media_id}`;
      // If user deleted it locally, we mark it deleted (e.g. status deleted marker, or filtered out)
      if ((item as any).is_deleted) {
        mergedMap.delete(key);
      } else {
        mergedMap.set(key, item);
      }
    });

    return Array.from(mergedMap.values()).sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return dateB - dateA;
    });
  }

  return tvtimeBaseList;
}

export async function upsertTrackedMedia(userId: string, media: Omit<TrackedMedia, 'user_id'>): Promise<TrackedMedia | null> {
  const payload: TrackedMedia = {
    ...media,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('tracked_media')
      .upsert(payload, { onConflict: 'user_id,media_id,media_type' })
      .select()
      .single();

    if (error) {
      console.error('Error upserting tracked media to Supabase:', error);
      return null;
    }
    return data;
  }

  // Local Storage Mock Upsert
  if (typeof window !== 'undefined') {
    const allTracked = JSON.parse(localStorage.getItem('piomdb_tracked_media') || '[]');
    const existingIndex = allTracked.findIndex(
      (item: TrackedMedia) =>
        item.user_id === userId &&
        item.media_id === media.media_id &&
        item.media_type === media.media_type
    );

    const updatedItem = {
      ...payload,
      id: existingIndex >= 0 ? allTracked[existingIndex].id : `trk_${Math.random().toString(36).substr(2, 9)}`,
    };

    if (existingIndex >= 0) {
      allTracked[existingIndex] = updatedItem;
    } else {
      allTracked.push(updatedItem);
    }

    localStorage.setItem('piomdb_tracked_media', JSON.stringify(allTracked));
    window.dispatchEvent(new Event('storage'));
    return updatedItem;
  }

  return null;
}

/** Bulk-upsert tracked media (e.g. from a CSV import) in a single write. */
export async function bulkImportTrackedMedia(
  userId: string,
  items: Omit<TrackedMedia, 'user_id'>[]
): Promise<void> {
  if (items.length === 0) return;

  if (isSupabaseConfigured && supabase) {
    const now = new Date().toISOString();
    const rows = items.map((item) => ({ ...item, user_id: userId, updated_at: now }));
    const { error } = await supabase.from('tracked_media').upsert(rows, { onConflict: 'user_id,media_id,media_type' });
    if (error) {
      console.error('Error bulk-importing tracked media to Supabase:', error);
      throw error;
    }
    return;
  }

  if (typeof window === 'undefined') return;
  const allTracked: TrackedMedia[] = JSON.parse(localStorage.getItem('piomdb_tracked_media') || '[]');
  const now = new Date().toISOString();

  for (const item of items) {
    const existingIndex = allTracked.findIndex(
      (t) => t.user_id === userId && t.media_id === item.media_id && t.media_type === item.media_type
    );
    const updatedItem: TrackedMedia = {
      ...item,
      user_id: userId,
      updated_at: now,
      id: existingIndex >= 0 ? allTracked[existingIndex].id : `trk_${Math.random().toString(36).substr(2, 9)}`,
    };
    if (existingIndex >= 0) allTracked[existingIndex] = updatedItem;
    else allTracked.push(updatedItem);
  }

  localStorage.setItem('piomdb_tracked_media', JSON.stringify(allTracked));
  window.dispatchEvent(new Event('storage'));
}

export async function deleteTrackedMedia(userId: string, mediaId: string, mediaType: 'movie' | 'tv'): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('tracked_media')
      .delete()
      .eq('user_id', userId)
      .eq('media_id', mediaId)
      .eq('media_type', mediaType);

    if (error) {
      console.error('Error deleting tracked media from Supabase:', error);
      return false;
    }
    return true;
  }

  // Local Storage Mock Delete
  if (typeof window !== 'undefined') {
    const allTracked = JSON.parse(localStorage.getItem('piomdb_tracked_media') || '[]');

    // Check if we are deleting an imported TV Time item. If so, store a custom deletion flag so it doesn't reappear on reload.
    const tvTimeItems = loadTVTimeTrackedMedia(userId);
    const isTVTimeItem = tvTimeItems.some((item) => item.media_id === mediaId && item.media_type === mediaType);

    if (isTVTimeItem) {
      const existingIndex = allTracked.findIndex(
        (item: TrackedMedia) =>
          item.user_id === userId &&
          item.media_id === mediaId &&
          item.media_type === mediaType
      );

      const deletedMarker = {
        user_id: userId,
        media_id: mediaId,
        media_type: mediaType,
        title: '',
        poster_path: '',
        status: 'Watched' as const,
        is_deleted: true,
        updated_at: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        allTracked[existingIndex] = deletedMarker;
      } else {
        allTracked.push(deletedMarker);
      }
    } else {
      // Just filter out standard local user tracked items
      const filtered = allTracked.filter(
        (item: TrackedMedia) =>
          !(item.user_id === userId && item.media_id === mediaId && item.media_type === mediaType)
      );
      localStorage.setItem('piomdb_tracked_media', JSON.stringify(filtered));
      window.dispatchEvent(new Event('storage'));
      return true;
    }

    localStorage.setItem('piomdb_tracked_media', JSON.stringify(allTracked));
    window.dispatchEvent(new Event('storage'));
    return true;
  }

  return false;
}
