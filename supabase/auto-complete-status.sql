-- Stores each TV show's total episode count so the database itself can decide
-- when a show is fully watched, instead of every write path (import, single
-- episode toggle, "mark all seen") having to duplicate that check.

alter table public.tracked_media add column if not exists total_episodes int;

create or replace function public.sync_watched_status()
returns trigger as $$
declare
  target_user_id uuid := coalesce(new.user_id, old.user_id);
  target_media_id text := coalesce(new.media_id, old.media_id);
  total int;
  watched_count int;
begin
  select total_episodes into total
  from public.tracked_media
  where user_id = target_user_id and media_id = target_media_id and media_type = 'tv';

  if total is null or total <= 0 then
    return coalesce(new, old);
  end if;

  select count(*) into watched_count
  from public.watched_episodes
  where user_id = target_user_id and media_id = target_media_id;

  if watched_count >= total then
    update public.tracked_media
    set status = 'Watched'
    where user_id = target_user_id
      and media_id = target_media_id
      and media_type = 'tv'
      and status <> 'Watched';
  end if;

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_watched_episode_change on public.watched_episodes;
create trigger on_watched_episode_change
  after insert or delete on public.watched_episodes
  for each row execute procedure public.sync_watched_status();
