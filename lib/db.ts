/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client dynamically
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if we have valid Supabase keys to use
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Tracked item types
export interface TrackedMedia {
  id?: string;
  user_id?: string;
  media_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string;
  status: 'Watched' | 'Want to Watch' | 'Currently Watching' | 'On Hold' | 'Favorites';
  user_rating?: number; // User rating out of 10
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

// Load initial mock user from localStorage if present in client environment
if (typeof window !== 'undefined') {
  const storedUser = localStorage.getItem('piomdb_mock_user');
  if (storedUser) {
    try {
      mockUser = JSON.parse(storedUser);
    } catch (_) {}
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

  // Fallback to local storage mock user
  return mockUser;
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

  // Fallback Mock Database load from localStorage
  if (typeof window !== 'undefined') {
    const allTracked = JSON.parse(localStorage.getItem('piomdb_tracked_media') || '[]');
    return allTracked.filter((item: TrackedMedia) => item.user_id === userId);
  }

  return [];
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

export async function deleteTrackedMedia(userId: string, mediaId: number, mediaType: 'movie' | 'tv'): Promise<boolean> {
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
    const filtered = allTracked.filter(
      (item: TrackedMedia) =>
        !(item.user_id === userId && item.media_id === mediaId && item.media_type === mediaType)
    );

    localStorage.setItem('piomdb_tracked_media', JSON.stringify(filtered));
    window.dispatchEvent(new Event('storage'));
    return true;
  }

  return false;
}
