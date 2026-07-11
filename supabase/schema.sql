-- ============================================================
-- Q8_ULTRA — database schema, security policies, seed data
-- Run this once in Supabase: Dashboard → SQL Editor → paste → Run
-- ============================================================

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  is_director boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "members can read profiles"
  on public.profiles for select to authenticated using (true);

create policy "insert own profile"
  on public.profiles for insert to authenticated with check (id = auth.uid());

create policy "update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- members may edit their name, but never their own director flag
revoke update on public.profiles from authenticated;
grant update (name) on public.profiles to authenticated;

-- auto-create a profile when a user signs up
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), 'Runner'));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- helper used by policies and the masked view
create function public.is_director(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_director from public.profiles where id = uid), false)
$$;

-- ---------- events ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('intl', 'local')),
  name text not null,
  date date not null,
  location text not null,
  country text not null default '',
  distances text[] not null,
  link text not null default '',
  note text not null default '',
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "members can read events"
  on public.events for select to authenticated using (true);

create policy "members can add events"
  on public.events for insert to authenticated with check (added_by = auth.uid());

create policy "creator or director can delete events"
  on public.events for delete to authenticated
  using (added_by = auth.uid() or public.is_director(auth.uid()));

-- ---------- entries (start lists) ----------
create table public.entries (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  distance text not null,
  mode text not null check (mode in ('crew', 'solo')),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.entries enable row level security;

-- the raw table is only readable by the owner of a row and directors;
-- everyone else reads through the masked start_list view below
create policy "read own entries or director reads all"
  on public.entries for select to authenticated
  using (user_id = auth.uid() or public.is_director(auth.uid()));

create policy "join races as yourself"
  on public.entries for insert to authenticated with check (user_id = auth.uid());

create policy "edit own entry"
  on public.entries for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "withdraw own entry"
  on public.entries for delete to authenticated using (user_id = auth.uid());

-- masked start list: name hiding is enforced by the DATABASE, not the client.
-- security_invoker = off → runs as owner, bypasses entries RLS in a controlled
-- way and applies the mask per requesting user via auth.uid().
create view public.start_list
with (security_invoker = off) as
select
  e.event_id,
  e.distance,
  e.mode,
  e.hidden,
  e.created_at,
  case
    when not e.hidden or e.user_id = auth.uid() or public.is_director(auth.uid())
    then p.name else 'Private runner'
  end as display_name,
  (e.user_id = auth.uid()) as is_self,
  case
    when not e.hidden or e.user_id = auth.uid() or public.is_director(auth.uid())
    then e.user_id else null
  end as user_id
from public.entries e
join public.profiles p on p.id = e.user_id;

grant select on public.start_list to authenticated;
revoke all on public.start_list from anon;

-- ---------- announcements (director only) ----------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  author uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy "members can read announcements"
  on public.announcements for select to authenticated using (true);

create policy "only director posts announcements"
  on public.announcements for insert to authenticated
  with check (public.is_director(auth.uid()) and author = auth.uid());

create policy "only director deletes announcements"
  on public.announcements for delete to authenticated
  using (public.is_director(auth.uid()));

-- ---------- wall (buy / sell) ----------
create table public.wall_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sell', 'want')),
  title text not null,
  details text not null default '',
  price text not null default '',
  contact text not null default '',
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.wall_posts enable row level security;

create policy "members can read the wall"
  on public.wall_posts for select to authenticated using (true);

create policy "post to the wall as yourself"
  on public.wall_posts for insert to authenticated with check (user_id = auth.uid());

create policy "delete own post or director deletes any"
  on public.wall_posts for delete to authenticated
  using (user_id = auth.uid() or public.is_director(auth.uid()));

-- ---------- seeded race calendar (dates verified 11 Jul 2026) ----------
insert into public.events (scope, name, date, location, country, distances, link, note) values
('intl', 'Eiger Ultra Trail by UTMB', '2026-07-15', 'Grindelwald', 'Switzerland', array['16K','35K','51K','101K','250K'], 'https://utmb.world/utmb-world-series-events', 'Race week 15–19 Jul'),
('intl', 'HOKA UTMB Mont-Blanc — Finals', '2026-08-24', 'Chamonix', 'France', array['ETC','MCC','OCC','TDS','CCC','UTMB'], 'https://utmb.world/utmb-world-series-events', 'Finals week 24–30 Aug · OCC 57K · CCC 101K · UTMB 100M'),
('intl', 'Wildstrubel by UTMB', '2026-09-10', 'Crans-Montana', 'Switzerland', array['26K','42K','55K','72K','113K'], 'https://utmb.world/utmb-world-series-events', '10–13 Sep'),
('intl', 'Kaçkar by UTMB', '2026-09-12', 'Ayder, Rize', 'Türkiye', array['20K','44K','82K'], 'https://utmb.world/utmb-world-series-events', 'Sat 12 Sep'),
('intl', 'Nice Côte d''Azur by UTMB', '2026-09-25', 'Nice', 'France', array['23K','50K','109K','165K'], 'https://utmb.world/utmb-world-series-events', '25–27 Sep'),
('intl', 'Mallorca by UTMB', '2026-10-23', 'Sóller', 'Spain', array['26K','56K','104K','138K'], 'https://utmb.world/utmb-world-series-events', '23–25 Oct'),
('intl', 'Kullamannen by UTMB', '2026-10-30', 'Båstad', 'Sweden', array['22K','53K','108K','100M'], 'https://utmb.world/utmb-world-series-events', '30 Oct – 1 Nov'),
('intl', 'TransLantau by UTMB', '2026-11-13', 'Lantau Island', 'Hong Kong', array['26K','52K','79K','116K'], 'https://utmb.world/utmb-world-series-events', '13–15 Nov'),
('intl', 'Doi Inthanon Thailand by UTMB', '2026-11-27', 'Chiang Mai', 'Thailand', array['20K','50K','100K','100M'], 'https://utmb.world/utmb-world-series-events', 'Major (double Running Stones) · window 27 Nov – 6 Dec'),
('intl', 'Oman by UTMB', '2026-12-10', 'Birkat Al Mouz, Hajar Mountains', 'Oman', array['20K','50K','100K','100M'], 'https://oman.utmb.world', '10–12 Dec · Hajar Ultra 100M & Jabal Classic 100K'),
('local', 'Gulf Bank 642 Marathon', '2026-11-28', 'Kuwait City — Souq Sharq', '', array['5K','10K','21K','42K'], 'https://www.gulfbank642marathon.com', 'Sat 28 Nov, 07:30 · World Athletics certified');
