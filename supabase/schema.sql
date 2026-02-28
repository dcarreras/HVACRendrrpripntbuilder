create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null,
  created_at timestamptz default now()
);

create unique index if not exists projects_name_company_key
  on projects (name, company);

create table if not exists renders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  project_id uuid references projects(id),
  system_type text,
  prompt_used text,
  image_url text,
  cost_usd numeric default 0.04,
  created_at timestamptz default now()
);

create index if not exists renders_user_created_at_idx
  on renders (user_id, created_at desc);

create index if not exists renders_project_created_at_idx
  on renders (project_id, created_at desc);

create table if not exists project_config (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) unique,
  palette jsonb,
  presets jsonb,
  openai_quality text default 'medium',
  budget_limit_usd numeric default 10,
  updated_at timestamptz default now()
);

alter table projects enable row level security;
alter table renders enable row level security;
alter table project_config enable row level security;

drop policy if exists "authenticated users can read projects" on projects;
create policy "authenticated users can read projects"
  on projects
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated users can create projects" on projects;
create policy "authenticated users can create projects"
  on projects
  for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated users can read project config" on project_config;
create policy "authenticated users can read project config"
  on project_config
  for select
  to authenticated
  using (true);

drop policy if exists "admins can insert project config" on project_config;
create policy "admins can insert project config"
  on project_config
  for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admins can update project config" on project_config;
create policy "admins can update project config"
  on project_config
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "users view own renders" on renders;
create policy "users view own renders"
  on renders
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "admins view all renders" on renders;
create policy "admins view all renders"
  on renders
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into storage.buckets (id, name, public)
values ('renders', 'renders', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "users can read their render objects" on storage.objects;
create policy "users can read their render objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'renders'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "admins can read all render objects" on storage.objects;
create policy "admins can read all render objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'renders'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
