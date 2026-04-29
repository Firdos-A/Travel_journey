-- ============================================================
-- Travel Journal - Supabase Database Schema
-- Run this in your Supabase SQL editor to set up the database.
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id         uuid primary key default uuid_generate_v4(),
  username   text unique not null,
  email      text unique not null,
  password_hash text,
  avatar_url text,
  bio        text,
  created_at timestamptz default now()
);

alter table profiles add column if not exists password_hash text;

create table if not exists journals (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references profiles(id) on delete cascade,
  title       text not null,
  description text,
  cover_image text,
  is_public   boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists entries (
  id          uuid primary key default uuid_generate_v4(),
  journal_id  uuid references journals(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  title       text not null,
  content     text,
  location    text,
  country     text,
  latitude    decimal(10, 8),
  longitude   decimal(11, 8),
  mood        text check (mood in ('amazing', 'happy', 'neutral', 'tired', 'difficult')),
  weather     text,
  cover_image text,
  travel_date date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists tags (
  id   uuid primary key default uuid_generate_v4(),
  name text unique not null
);

create table if not exists entry_tags (
  entry_id uuid references entries(id) on delete cascade,
  tag_id   uuid references tags(id) on delete cascade,
  primary key (entry_id, tag_id)
);

create table if not exists photos (
  id         uuid primary key default uuid_generate_v4(),
  entry_id   uuid references entries(id) on delete cascade,
  url        text not null,
  caption    text,
  created_at timestamptz default now()
);

create index if not exists idx_entries_journal on entries(journal_id);
create index if not exists idx_entries_user on entries(user_id);
create index if not exists idx_entries_date on entries(travel_date);
create index if not exists idx_journals_user on journals(user_id);
create index if not exists idx_photos_entry on photos(entry_id);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_journals_updated on journals;
create trigger trg_journals_updated
  before update on journals
  for each row execute function update_updated_at();

drop trigger if exists trg_entries_updated on entries;
create trigger trg_entries_updated
  before update on entries
  for each row execute function update_updated_at();

alter table profiles enable row level security;
alter table journals enable row level security;
alter table entries enable row level security;
alter table tags enable row level security;
alter table entry_tags enable row level security;
alter table photos enable row level security;

drop policy if exists "Public journals are viewable" on journals;
create policy "Public journals are viewable"
  on journals for select
  using (is_public = true);

drop policy if exists "Allow all for authenticated" on profiles;
create policy "Allow all for authenticated"
  on profiles for all
  using (true)
  with check (true);

drop policy if exists "Allow all on journals" on journals;
create policy "Allow all on journals"
  on journals for all
  using (true)
  with check (true);

drop policy if exists "Allow all on entries" on entries;
create policy "Allow all on entries"
  on entries for all
  using (true)
  with check (true);

drop policy if exists "Allow all on tags" on tags;
create policy "Allow all on tags"
  on tags for all
  using (true)
  with check (true);

drop policy if exists "Allow all on entry_tags" on entry_tags;
create policy "Allow all on entry_tags"
  on entry_tags for all
  using (true)
  with check (true);

drop policy if exists "Allow all on photos" on photos;
create policy "Allow all on photos"
  on photos for all
  using (true)
  with check (true);

insert into tags (name) values
  ('adventure'), ('food'), ('culture'), ('nature'), ('city'),
  ('beach'), ('mountains'), ('roadtrip'), ('solo'), ('family'),
  ('backpacking'), ('luxury'), ('history'), ('art'), ('photography')
on conflict (name) do nothing;

