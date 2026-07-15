-- Wipes tracked shows/movies and watched-episode rows so they can be
-- re-imported with TMDB ids (the OMDb "tt..." ids they currently hold are
-- incompatible with the TMDB-based media_id scheme).
-- Does NOT touch profiles or auth.users — you stay logged in.

truncate table public.watched_episodes;
truncate table public.tracked_media;
