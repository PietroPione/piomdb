/**
 * Detail Page Layout Configuration
 *
 * Edit this file to control the visibility and exact order of information
 * rendered on the Movie/TV Show detail page.
 *
 * Supported block ids:
 * - 'header'      (Title, Tagline, Backdrop, Poster, Status Selectors)
 * - 'overview'    (The synopsis / plot summary)
 * - 'genres'      (List of genre badges)
 * - 'metadata'    (Release date, status, run time, budget, revenue, etc.)
 * - 'rating'      (Vote average / TMDB rating score)
 * - 'cast'        (List of main actors / characters)
 * - 'crew'        (Directors, writers, executive producers)
 */

export interface LayoutBlock {
  id: 'header' | 'overview' | 'genres' | 'metadata' | 'rating' | 'cast' | 'crew';
  label: string;
  enabled: boolean;
}

export const DETAIL_LAYOUT_CONFIG: LayoutBlock[] = [
  { id: 'header', label: 'Header with Poster & Title', enabled: true },
  { id: 'rating', label: 'Rating & Vote Count', enabled: true },
  { id: 'genres', label: 'Genres', enabled: true },
  { id: 'overview', label: 'Overview / Synopsis', enabled: true },
  { id: 'metadata', label: 'Metadata (Release Date, Run Time, Status)', enabled: true },
  { id: 'cast', label: 'Cast (Main Actors)', enabled: true },
  { id: 'crew', label: 'Crew (Directors, Writers)', enabled: true },
];
