create table if not exists public.stw_responses (
  id text primary key,
  name text not null,
  see jsonb not null default '[]'::jsonb,
  think jsonb not null default '[]'::jsonb,
  wonder jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.stw_responses enable row level security;

drop policy if exists "stw_select_all" on public.stw_responses;
create policy "stw_select_all"
on public.stw_responses
for select
to anon
using (true);

drop policy if exists "stw_insert_all" on public.stw_responses;
create policy "stw_insert_all"
on public.stw_responses
for insert
to anon
with check (true);

drop policy if exists "stw_update_all" on public.stw_responses;
create policy "stw_update_all"
on public.stw_responses
for update
to anon
using (true)
with check (true);

drop policy if exists "stw_delete_all" on public.stw_responses;
create policy "stw_delete_all"
on public.stw_responses
for delete
to anon
using (true);

create table if not exists public.stw_settings (
  id text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.stw_settings enable row level security;

drop policy if exists "stw_settings_select_all" on public.stw_settings;
create policy "stw_settings_select_all"
on public.stw_settings
for select
to anon
using (true);

drop policy if exists "stw_settings_insert_all" on public.stw_settings;
create policy "stw_settings_insert_all"
on public.stw_settings
for insert
to anon
with check (true);

drop policy if exists "stw_settings_update_all" on public.stw_settings;
create policy "stw_settings_update_all"
on public.stw_settings
for update
to anon
using (true)
with check (true);
