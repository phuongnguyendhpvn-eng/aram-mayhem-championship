-- ARAM MAYHEM CHAMPIONSHIP
-- Chạy toàn bộ file này trong Supabase > SQL Editor.
-- Chỉ public đọc dữ liệu. Chỉ UUID được đăng ký trong admin_users được ghi dữ liệu.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  sort_order integer not null unique check (sort_order between 1 and 3),
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  match_no integer not null unique check (match_no between 1 and 3),
  team_a_id uuid not null references public.teams(id) on delete cascade,
  team_b_id uuid not null references public.teams(id) on delete cascade,
  winner_team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint different_teams check (team_a_id <> team_b_id),
  constraint winner_is_participant check (winner_team_id is null or winner_team_id = team_a_id or winner_team_id = team_b_id)
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.admin_users enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;

drop policy if exists "admin users cannot be read publicly" on public.admin_users;
drop policy if exists "admin users read own row" on public.admin_users;
create policy "admin users read own row" on public.admin_users
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "public can read teams" on public.teams;
create policy "public can read teams" on public.teams for select to anon, authenticated using (true);
drop policy if exists "admin can insert teams" on public.teams;
create policy "admin can insert teams" on public.teams for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "admin can update teams" on public.teams;
create policy "admin can update teams" on public.teams for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admin can delete teams" on public.teams;
create policy "admin can delete teams" on public.teams for delete to authenticated using ((select public.is_admin()));

drop policy if exists "public can read players" on public.players;
create policy "public can read players" on public.players for select to anon, authenticated using (true);
drop policy if exists "admin can insert players" on public.players;
create policy "admin can insert players" on public.players for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "admin can update players" on public.players;
create policy "admin can update players" on public.players for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admin can delete players" on public.players;
create policy "admin can delete players" on public.players for delete to authenticated using ((select public.is_admin()));

drop policy if exists "public can read matches" on public.matches;
create policy "public can read matches" on public.matches for select to anon, authenticated using (true);
drop policy if exists "admin can insert matches" on public.matches;
create policy "admin can insert matches" on public.matches for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "admin can update matches" on public.matches;
create policy "admin can update matches" on public.matches for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admin can delete matches" on public.matches;
create policy "admin can delete matches" on public.matches for delete to authenticated using ((select public.is_admin()));

-- Bật realtime cho 3 bảng dữ liệu công khai.
do $$
begin
  alter publication supabase_realtime add table public.players;
exception when duplicate_object then null;
when others then
  if sqlerrm not ilike '%already member%' then raise; end if;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.teams;
exception when duplicate_object then null;
when others then
  if sqlerrm not ilike '%already member%' then raise; end if;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null;
when others then
  if sqlerrm not ilike '%already member%' then raise; end if;
end $$;

-- Không cho public tự đăng ký Admin. Tắt sign-ups trong Authentication settings.
-- Tạo user Admin thủ công trong Supabase Dashboard, sau đó chạy:
-- insert into public.admin_users (user_id) values ('UUID_CUA_ADMIN');
-- Chỉ người sở hữu project mới được tự thêm UUID vào bảng admin_users.
