create type public.app_role as enum ('admin','moderator','user');
create type public.incident_category as enum ('harassment','stalking','sexual_assault','other');
create type public.report_type as enum ('firsthand','witnessed','disclosed');
create type public.report_status as enum ('awaiting_review','needs_clarification','published','not_published','removed');

create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create or replace function public.is_moderator(_user_id uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role in ('moderator','admin')) $$;
create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create table public.profiles (id uuid primary key, display_name text not null check (char_length(display_name) between 2 and 40), created_at timestamptz not null default now());
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Signed-in users read display names" on public.profiles for select to authenticated using (true);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "Users update own profile" on public.profiles for update to authenticated using (id = auth.uid());
create policy "Users delete own profile" on public.profiles for delete to authenticated using (id = auth.uid());

create table public.published_incidents (
  id uuid primary key default gen_random_uuid(),
  category incident_category not null, report_type report_type not null,
  lat double precision not null, lng double precision not null,
  area_label text not null, date_from date not null, date_to date not null,
  summary text, is_sample boolean not null default false,
  published_at timestamptz not null default now(), updated_at timestamptz not null default now());
grant select on public.published_incidents to anon, authenticated;
grant insert, update, delete on public.published_incidents to authenticated;
grant all on public.published_incidents to service_role;
alter table public.published_incidents enable row level security;
create policy "Anyone reads published incidents" on public.published_incidents for select to anon, authenticated using (true);
create policy "Moderators insert published" on public.published_incidents for insert to authenticated with check (public.is_moderator(auth.uid()));
create policy "Moderators update published" on public.published_incidents for update to authenticated using (public.is_moderator(auth.uid()));
create policy "Moderators delete published" on public.published_incidents for delete to authenticated using (public.is_moderator(auth.uid()));

create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null unique default ('HW-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,7))),
  reporter_id uuid not null,
  report_type report_type not null, category incident_category not null,
  date_from date not null, date_to date not null,
  time_range text check (time_range is null or char_length(time_range) <= 40),
  description text check (description is null or char_length(description) <= 1000),
  context_details text check (context_details is null or char_length(context_details) <= 300),
  consent_context text check (consent_context in ('consented','not_sure','not_asked') or consent_context is null),
  lat double precision not null, lng double precision not null,
  place_label text check (place_label is null or char_length(place_label) <= 200),
  status report_status not null default 'awaiting_review',
  published_id uuid references public.published_incidents(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
grant select, insert, update, delete on public.incident_reports to authenticated;
grant all on public.incident_reports to service_role;
alter table public.incident_reports enable row level security;
create policy "Reporters read own reports" on public.incident_reports for select to authenticated using (reporter_id = auth.uid() or public.is_moderator(auth.uid()));
create policy "Reporters submit own reports" on public.incident_reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'awaiting_review' and published_id is null);
create policy "Moderators update reports" on public.incident_reports for update to authenticated using (public.is_moderator(auth.uid()));
create policy "Reporters delete own reports" on public.incident_reports for delete to authenticated using (reporter_id = auth.uid());

create or replace function public.limit_report_rate() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.incident_reports where reporter_id = new.reporter_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'You can submit up to 5 reports per day. Please try again later.';
  end if;
  if new.date_from > current_date or new.date_to < new.date_from then
    raise exception 'Please check the incident date.';
  end if;
  return new;
end $$;
create trigger incident_reports_rate before insert on public.incident_reports for each row execute function public.limit_report_rate();

create table public.clarification_messages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.incident_reports(id) on delete cascade,
  author_id uuid not null, from_moderator boolean not null default false,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now());
grant select, insert on public.clarification_messages to authenticated;
grant all on public.clarification_messages to service_role;
alter table public.clarification_messages enable row level security;
create policy "Participants read clarifications" on public.clarification_messages for select to authenticated using (public.is_moderator(auth.uid()) or exists (select 1 from public.incident_reports r where r.id = report_id and r.reporter_id = auth.uid()));
create policy "Participants write clarifications" on public.clarification_messages for insert to authenticated with check (author_id = auth.uid() and ((from_moderator and public.is_moderator(auth.uid())) or (not from_moderator and exists (select 1 from public.incident_reports r where r.id = report_id and r.reporter_id = auth.uid()))));

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.incident_reports(id) on delete set null,
  published_id uuid, moderator_id uuid not null,
  action text not null, reason text not null check (char_length(reason) between 3 and 1000),
  created_at timestamptz not null default now());
grant select, insert on public.moderation_actions to authenticated;
grant all on public.moderation_actions to service_role;
alter table public.moderation_actions enable row level security;
create policy "Moderators read audit" on public.moderation_actions for select to authenticated using (public.is_moderator(auth.uid()));
create policy "Moderators append audit" on public.moderation_actions for insert to authenticated with check (moderator_id = auth.uid() and public.is_moderator(auth.uid()));

create table public.incident_flags (
  id uuid primary key default gen_random_uuid(),
  published_id uuid not null references public.published_incidents(id) on delete cascade,
  user_id uuid not null, reason text not null check (reason in ('inaccurate','identifies_someone','duplicate','harmful','other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now());
grant select, insert, update on public.incident_flags to authenticated;
grant all on public.incident_flags to service_role;
alter table public.incident_flags enable row level security;
create policy "Flag owners and moderators read" on public.incident_flags for select to authenticated using (user_id = auth.uid() or public.is_moderator(auth.uid()));
create policy "Users submit flags" on public.incident_flags for insert to authenticated with check (user_id = auth.uid() and status = 'open');
create policy "Moderators resolve flags" on public.incident_flags for update to authenticated using (public.is_moderator(auth.uid()));

create table public.saved_places (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  label text not null check (char_length(label) between 1 and 80),
  lat double precision not null, lng double precision not null,
  created_at timestamptz not null default now());
grant select, insert, update, delete on public.saved_places to authenticated;
grant all on public.saved_places to service_role;
alter table public.saved_places enable row level security;
create policy "Owners manage saved places" on public.saved_places for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.support_resources (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text, url text, description text not null,
  kind text not null check (kind in ('emergency','helpline','service')),
  hours text, is_verified boolean not null default false, last_checked date,
  sort_order int not null default 0);
grant select on public.support_resources to anon, authenticated;
grant all on public.support_resources to service_role;
alter table public.support_resources enable row level security;
create policy "Anyone reads support resources" on public.support_resources for select to anon, authenticated using (true);

insert into public.support_resources (name, phone, description, kind, hours, is_verified, last_checked, sort_order) values
('National Emergency Service', '999', 'Bangladesh national emergency number for police, fire service and ambulance.', 'emergency', 'Proposed: 24 hours', false, null, 1),
('National Helpline Centre for Violence against Women and Children', '109', 'Government helpline for women and children facing violence. Proposed resource, to be verified before launch.', 'helpline', 'Proposed: 24 hours', false, null, 2);

insert into public.published_incidents (category,report_type,lat,lng,area_label,date_from,date_to,summary,is_sample,published_at) values
('harassment','witnessed',22.3626,91.8116,'Near GEC Circle, Chattogram','2025-12-28','2025-12-28','Unwanted comments and following reported on a busy footpath.',true,'2026-01-01'),
('other','firsthand',23.7354,90.3744,'Near Dhanmondi, Dhaka','2026-08-24','2026-08-24','Poor lighting and an uncomfortable encounter reported near an underpass.',true,'2026-08-28'),
('stalking','firsthand',23.6308,90.491,'Near Narayanganj Chashara','2026-06-06','2026-06-19','Repeated following reported between a market and residential lanes.',true,'2026-06-23'),
('harassment','firsthand',24.886,91.8783,'Near Zindabazar, Sylhet','2026-05-03','2026-05-09','Verbal harassment reported near a bus stop during evening hours.',true,'2026-05-13'),
('harassment','disclosed',23.6184,90.5076,'Near Narayanganj Chashara','2026-06-28','2026-06-28','Harassment reported on a crowded public bus.',true,'2026-07-02'),
('stalking','firsthand',23.7394,90.3853,'Near Shahbagh, Dhaka','2026-08-29','2026-09-11','Repeated following reported between a market and residential lanes.',true,'2026-09-15'),
('other','witnessed',23.4677,91.1802,'Near Kandirpar, Cumilla','2026-02-08','2026-02-14','Safety concern reported near a quiet stretch after dark.',true,'2026-02-18'),
('harassment','firsthand',23.768,90.4002,'Near Mohakhali, Dhaka','2026-01-18','2026-01-24','Harassment reported on a crowded public bus.',true,'2026-01-28'),
('harassment','disclosed',22.8275,89.5468,'Near Shibbari, Khulna','2026-02-26','2026-02-26','Unwanted comments and following reported on a busy footpath.',true,'2026-03-02'),
('sexual_assault','witnessed',23.8617,90.4024,'Near Uttara Sector 7, Dhaka','2025-09-02','2025-09-15','Physical assault reported in a crowded transport setting. Details withheld for privacy.',true,'2025-09-19'),
('stalking','disclosed',22.3589,91.829,'Near GEC Circle, Chattogram','2026-08-24','2026-08-24','Reporter noticed being followed on the same route several times.',true,'2026-08-28'),
('harassment','firsthand',23.4665,91.1764,'Near Kandirpar, Cumilla','2025-12-07','2025-12-20','Unwanted comments and following reported on a busy footpath.',true,'2025-12-24'),
('stalking','witnessed',23.7691,90.4256,'Near Badda, Dhaka','2026-07-04','2026-07-17','Repeated following reported between a market and residential lanes.',true,'2026-07-21'),
('harassment','firsthand',23.4674,91.1721,'Near Kandirpar, Cumilla','2026-05-25','2026-05-31','Unwanted comments and following reported on a busy footpath.',true,'2026-06-04'),
('harassment','firsthand',23.4598,91.1822,'Near Kandirpar, Cumilla','2026-07-20','2026-07-26','Harassment reported on a crowded public bus.',true,'2026-07-30'),
('stalking','witnessed',23.7148,90.432,'Near Jatrabari, Dhaka','2026-06-02','2026-06-02','Repeated following reported between a market and residential lanes.',true,'2026-06-06'),
('harassment','firsthand',23.7368,90.4055,'Near Motijheel, Dhaka','2025-12-01','2025-12-01','Unwanted comments and following reported on a busy footpath.',true,'2025-12-05'),
('harassment','firsthand',23.7787,90.4234,'Near Badda, Dhaka','2025-12-13','2025-12-19','Verbal harassment reported near a bus stop during evening hours.',true,'2025-12-23'),
('other','firsthand',23.998,90.4289,'Near Gazipur Chowrasta','2025-10-15','2025-10-28','Safety concern reported near a quiet stretch after dark.',true,'2025-11-01'),
('stalking','witnessed',24.8874,91.8729,'Near Zindabazar, Sylhet','2026-08-28','2026-08-28','Repeated following reported between a market and residential lanes.',true,'2026-09-01'),
('sexual_assault','firsthand',23.7289,90.3982,'Near Shahbagh, Dhaka','2026-08-07','2026-08-07','Physical assault reported in a crowded transport setting. Details withheld for privacy.',true,'2026-08-11'),
('harassment','witnessed',23.6257,90.4897,'Near Narayanganj Chashara','2026-06-14','2026-06-27','Unwanted comments and following reported on a busy footpath.',true,'2026-07-01'),
('harassment','witnessed',23.8753,90.3978,'Near Uttara Sector 7, Dhaka','2026-07-31','2026-08-06','Unwanted comments and following reported on a busy footpath.',true,'2026-08-10'),
('sexual_assault','firsthand',23.4511,91.1715,'Near Kandirpar, Cumilla','2026-04-06','2026-04-19','Physical assault reported in a crowded transport setting. Details withheld for privacy.',true,'2026-04-23'),
('harassment','disclosed',23.4496,91.1918,'Near Kandirpar, Cumilla','2026-01-01','2026-01-07','Verbal harassment reported near a bus stop during evening hours.',true,'2026-01-11'),
('harassment','disclosed',23.6182,90.5034,'Near Narayanganj Chashara','2026-08-13','2026-08-26','Unwanted comments and following reported on a busy footpath.',true,'2026-08-30'),
('stalking','firsthand',23.9955,90.4133,'Near Gazipur Chowrasta','2025-12-25','2026-01-07','Reporter noticed being followed on the same route several times.',true,'2026-01-11'),
('other','firsthand',23.7853,90.4126,'Near Mohakhali, Dhaka','2025-09-15','2025-09-15','Poor lighting and an uncomfortable encounter reported near an underpass.',true,'2025-09-19'),
('sexual_assault','witnessed',24.0045,90.4318,'Near Gazipur Chowrasta','2025-08-20','2025-08-26','Physical assault reported in a crowded transport setting. Details withheld for privacy.',true,'2025-08-30'),
('harassment','disclosed',23.7214,90.4336,'Near Jatrabari, Dhaka','2025-09-23','2025-09-29','Unwanted comments and following reported on a busy footpath.',true,'2025-10-03'),
('harassment','firsthand',23.7515,90.3824,'Near Farmgate, Dhaka','2026-06-16','2026-06-22','Harassment reported on a crowded public bus.',true,'2026-06-26'),
('sexual_assault','witnessed',23.8141,90.3587,'Near Mirpur 10, Dhaka','2025-10-25','2025-10-25','Physical assault reported in a crowded transport setting. Details withheld for privacy.',true,'2025-10-29'),
('sexual_assault','firsthand',23.7367,90.3991,'Near Shahbagh, Dhaka','2026-08-15','2026-08-28','Physical assault reported in a crowded transport setting. Details withheld for privacy.',true,'2026-09-01'),
('stalking','firsthand',22.8214,89.5481,'Near Shibbari, Khulna','2026-07-25','2026-07-25','Repeated following reported between a market and residential lanes.',true,'2026-07-29'),
('harassment','disclosed',22.8238,89.5675,'Near Shibbari, Khulna','2025-10-27','2025-11-02','Verbal harassment reported near a bus stop during evening hours.',true,'2025-11-06'),
('other','firsthand',23.6115,90.5072,'Near Narayanganj Chashara','2025-09-22','2025-10-05','Poor lighting and an uncomfortable encounter reported near an underpass.',true,'2025-10-09'),
('harassment','witnessed',24.0107,90.4127,'Near Gazipur Chowrasta','2026-06-12','2026-06-12','Unwanted comments and following reported on a busy footpath.',true,'2026-06-16'),
('harassment','disclosed',23.7321,90.3979,'Near Shahbagh, Dhaka','2026-05-19','2026-06-01','Unwanted comments and following reported on a busy footpath.',true,'2026-06-05'),
('harassment','witnessed',23.8823,90.4023,'Near Uttara Sector 7, Dhaka','2025-08-07','2025-08-20','Unwanted comments and following reported on a busy footpath.',true,'2025-08-24'),
('harassment','disclosed',23.9906,90.4203,'Near Gazipur Chowrasta','2026-02-15','2026-02-15','Harassment reported on a crowded public bus.',true,'2026-02-19'),
('harassment','firsthand',23.7983,90.3716,'Near Mirpur 10, Dhaka','2026-07-29','2026-08-11','Verbal harassment reported near a bus stop during evening hours.',true,'2026-08-15'),
('other','disclosed',22.3603,91.8287,'Near GEC Circle, Chattogram','2026-08-05','2026-08-18','Poor lighting and an uncomfortable encounter reported near an underpass.',true,'2026-08-22'),
('harassment','firsthand',23.767,90.3953,'Near Mohakhali, Dhaka','2026-02-09','2026-02-22','Verbal harassment reported near a bus stop during evening hours.',true,'2026-02-26'),
('sexual_assault','witnessed',23.7608,90.3898,'Near Farmgate, Dhaka','2026-01-09','2026-01-09','Physical assault reported in a crowded transport setting. Details withheld for privacy.',true,'2026-01-13'),
('other','disclosed',22.8234,89.5562,'Near Shibbari, Khulna','2026-05-25','2026-06-07','Safety concern reported near a quiet stretch after dark.',true,'2026-06-11'),
('harassment','witnessed',23.6143,90.4909,'Near Narayanganj Chashara','2026-02-14','2026-02-20','Verbal harassment reported near a bus stop during evening hours.',true,'2026-02-24'),
('stalking','firsthand',23.7711,90.4003,'Near Mohakhali, Dhaka','2026-07-28','2026-07-28','Reporter noticed being followed on the same route several times.',true,'2026-08-01'),
('harassment','firsthand',23.884,90.3917,'Near Uttara Sector 7, Dhaka','2026-08-11','2026-08-17','Unwanted comments and following reported on a busy footpath.',true,'2026-08-21');