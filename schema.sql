--
-- PIOMDB SUPABASE SCHEMA SETUP
--
-- Run this SQL in your Supabase SQL Editor to configure your database tables
-- and enable Row Level Security (RLS) rules correctly.
--

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create public profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  username text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using (true);

create policy "Users can insert or update their own profile."
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile."
  on public.profiles for update
  using (auth.uid() = id);


-- Create tracked_media table
create table public.tracked_media (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  media_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text not null,
  status text not null check (status in ('Watched', 'Want to Watch', 'Currently Watching', 'On Hold', 'Favorites')),
  user_rating integer check (user_rating >= 1 and user_rating <= 10),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Prevent duplicate tracking of the same show/movie by the same user
  constraint unique_user_media unique (user_id, media_id, media_type)
);

-- Enable RLS for tracked_media
alter table public.tracked_media enable row level security;

create policy "Users can view their own tracked media."
  on public.tracked_media for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tracked media."
  on public.tracked_media for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tracked media."
  on public.tracked_media for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tracked media."
  on public.tracked_media for delete
  using (auth.uid() = user_id);

-- Create simple function and trigger to handle automatic profile creation on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
