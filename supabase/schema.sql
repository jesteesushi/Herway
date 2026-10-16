-- ==============================================================================
-- HerWay Stage 5 Database Schema & Security Policies
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run
-- ==============================================================================

create extension if not exists postgis;

-- 1. ENUMS (created conditionally to support idempotent runs)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'pub_status') then
    create type pub_status as enum (
      'official_alert',
      'source_reported',
      'under_review',
      'unverified_submission',
      'corrected_retracted',
      'rejected'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'loc_precision') then
    create type loc_precision as enum ('exact','area','locality','district','unknown');
  end if;
end $$;

-- 2. TABLES
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  source_type text not null check (source_type in ('official','news','ngo','other')),
  integration text not null default 'manual' check (integration in ('rss','api','manual','blocked')),
  last_success_at timestamptz,
  last_error text,
  notes text
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete set null,
  source_item_id text,
  source_name text,
  source_url text,
  source_type text,
  division text,
  district text,
  thana_upazila text,
  area_block text,
  road_name_number text,
  landmark text,
  latitude double precision,
  longitude double precision,
  location_precision loc_precision not null default 'unknown',
  category text not null default 'alert',
  incident_occurred_at timestamptz,
  source_published_at timestamptz,
  source_updated_at timestamptz,
  retrieved_at timestamptz default now(),
  summary text,
  evidence_media_url text,
  publication_status pub_status not null default 'under_review',
  verification_notes text,
  last_checked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (source_id, source_item_id)
);

create index if not exists idx_incidents_pub_date on public.incidents (publication_status, source_published_at desc);
create index if not exists idx_incidents_category on public.incidents (category);
create index if not exists idx_incidents_district on public.incidents (district);

create table if not exists public.incident_audit (
  id bigserial primary key,
  incident_id uuid references public.incidents(id) on delete cascade,
  actor uuid,
  action text not null,
  reason text,
  diff jsonb,
  at timestamptz default now()
);

-- Submissions table: private, never publicly readable, length constrained
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  category text check (category is null or char_length(category) <= 50),
  district text check (district is null or char_length(district) <= 100),
  area_text text check (area_text is null or char_length(area_text) <= 200),
  description text check (description is null or char_length(description) <= 2000),
  occurred_on date,
  consent boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected','spam')),
  created_at timestamptz default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- 3. PUBLIC VIEW
-- security_invoker = false (default) ensures the view runs with owner privileges,
-- granting public access to published records while base table incidents stays locked.
create or replace view public.public_incidents with (security_invoker = false) as
select
  id,
  source_name,
  source_url,
  source_type,
  division,
  district,
  thana_upazila,
  area_block,
  latitude,
  longitude,
  location_precision,
  category,
  incident_occurred_at,
  source_published_at,
  source_updated_at,
  summary,
  publication_status,
  updated_at
from public.incidents
where publication_status in ('official_alert','source_reported','corrected_retracted');

-- 4. ROW LEVEL SECURITY
alter table public.sources enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_audit enable row level security;
alter table public.submissions enable row level security;
alter table public.admins enable row level security;

-- 5. ADMIN CHECK FUNCTION
-- Fixed: set search_path = public prevents search_path injection attacks
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- 6. RLS POLICIES
-- Drop existing policies if re-running
drop policy if exists "admin all incidents" on public.incidents;
drop policy if exists "admin all sources" on public.sources;
drop policy if exists "admin read audit" on public.incident_audit;
drop policy if exists "admin all submissions" on public.submissions;
drop policy if exists "anyone can submit" on public.submissions;
drop policy if exists "admin read admins" on public.admins;

-- Base incidents table: only admins can select/insert/update/delete directly
create policy "admin all incidents" on public.incidents for all using (public.is_admin()) with check (public.is_admin());

-- Sources: anyone can read sources list for the Data Sources transparency page; admins manage
create policy "anyone reads sources" on public.sources for select using (true);
create policy "admin manage sources" on public.sources for all using (public.is_admin()) with check (public.is_admin());

-- Audit log: only admins can read
create policy "admin read audit" on public.incident_audit for select using (public.is_admin());
create policy "admin insert audit" on public.incident_audit for insert with check (public.is_admin());

-- Submissions: only admins can read and manage.
-- Fixed: Anonymous direct INSERT is removed. Submissions are accepted only via server API using service_role.
create policy "admin all submissions" on public.submissions for all using (public.is_admin()) with check (public.is_admin());

-- Admins: only admins can inspect the admin list
create policy "admin read admins" on public.admins for select using (public.is_admin());

-- 7. PERMISSIONS & GRANTS
-- Revoke direct anon access to private base tables
revoke all on public.incidents from anon;
revoke all on public.submissions from anon;
revoke all on public.admins from anon;
revoke all on public.incident_audit from anon;

-- Grant select on public view and public sources to anonymous and authenticated users
grant select on public.public_incidents to anon, authenticated;
grant select on public.sources to anon, authenticated;

-- Service role has full access for server functions / ingest APIs
grant all on public.sources to service_role;
grant all on public.incidents to service_role;
grant all on public.incident_audit to service_role;
grant all on public.submissions to service_role;
grant all on public.admins to service_role;

-- 8. SEED VERIFIED SOURCES
insert into public.sources (name, url, source_type, integration, notes) values
  ('Dhaka Metropolitan Police', 'https://dmp.gov.bd/feed/', 'official', 'rss', 'Verified RSS 2.0 feed'),
  ('The Daily Star', 'https://www.thedailystar.net/news/bangladesh/rss.xml', 'news', 'rss', 'Verified RSS 2.0 news feed'),
  ('Prothom Alo English', 'https://en.prothomalo.com/feed', 'news', 'rss', 'Verified English RSS feed'),
  ('bdnews24 English', 'https://prod-qt-images.s3.amazonaws.com/production/bdnews24-english/feed.xml', 'news', 'rss', 'Verified Atom XML news feed'),
  ('Ain o Salish Kendra', 'https://www.askbd.org/ask/feed/', 'ngo', 'rss', 'Human rights reports; Crawl-Delay 20 observed'),
  ('Bangladesh Mahila Parishad', 'https://mahilaparishad.org/feed/', 'ngo', 'rss', 'Women advocacy reports RSS'),
  ('BNWLA', 'https://bnwla-bd.org/feed/', 'ngo', 'rss', 'Legal aid reports; Crawl-Delay 20 observed'),
  ('Bangladesh Police', 'https://www.police.gov.bd', 'official', 'manual', 'No public RSS feed available; monitored manually')
on conflict do nothing;

