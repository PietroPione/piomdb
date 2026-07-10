/* eslint-disable @typescript-eslint/no-explicit-any */
import { TrackedMedia, UserProfile } from "./db";
import tvTimeData from "./tvtime_data.json";

/**
 * Loads the main user details from user.csv
 */
export function loadTVTimeUser(): UserProfile {
  return {
    id: tvTimeData.user.id,
    email: tvTimeData.user.email,
    username: tvTimeData.user.username,
    created_at: tvTimeData.user.created_at,
  };
}

/**
 * Loads followed TV show records from user_tv_show_data.csv and maps them to TrackedMedia format
 */
export function loadTVTimeTrackedMedia(userId: string): TrackedMedia[] {
  // Return the pre-compiled mock shows list with mapped status categories
  return (tvTimeData.tracked as any[]).map((item) => ({
    ...item,
    user_id: userId,
  }));
}

/**
 * Loads user statistics from user_statistics.csv
 */
export interface TVTimeStats {
  timeSpent: number; // in minutes
  showsFollowedCount: number;
}

export function loadTVTimeStats(): TVTimeStats {
  return {
    timeSpent: tvTimeData.stats.timeSpent,
    showsFollowedCount: tvTimeData.stats.showsFollowedCount,
  };
}
