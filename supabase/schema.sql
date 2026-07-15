-- piomdb schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Matches the shape lib/db.ts already expects.
--
-- Safe to run even if the OLD root-level schema.sql was applied first: this
-- drops those incompatible objects (integer media_id, no is_favorite column,
-- no watched_episodes table) before recreating everything correctly.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.watched_episodes cascade;
drop table if exists public.tracked_media cascade;
drop table if exists public.profiles cascade;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  username text,
  created_at timestamptz not null default now()
);

create table if not exists public.tracked_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  media_id text not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text,
  status text not null check (status in ('Watched', 'Want to Watch', 'Currently Watching', 'On Hold')),
  is_favorite boolean not null default false,
  user_rating int check (user_rating between 1 and 10),
  updated_at timestamptz not null default now(),
  unique (user_id, media_id, media_type)
);

create table if not exists public.watched_episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  media_id text not null,
  season int not null,
  episode int not null,
  updated_at timestamptz not null default now(),
  unique (user_id, media_id, season, episode)
);

alter table public.profiles enable row level security;
alter table public.tracked_media enable row level security;
alter table public.watched_episodes enable row level security;

create policy "Users manage their own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage their own tracked media" on public.tracked_media
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own watched episodes" on public.watched_episodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profiles row on signup (belt-and-suspenders alongside the
-- manual upsert lib/db.ts's signUpUser() already does).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
