-- profiles: extends auth.users with tier + Stripe linkage
create table public.profiles (
  id uuid references auth.users primary key,
  tier text not null default 'free',
  stripe_customer_id text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- runs: deliberation runs (web + CLI)
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  question text not null,
  mode text not null,
  domain text,
  phase text not null default 'done',
  payload jsonb not null,
  is_public boolean not null default false,
  slug text unique,
  source text default 'web',
  created_at timestamptz default now()
);
alter table public.runs enable row level security;
create policy "Users can read own runs" on public.runs for select using (auth.uid() = user_id);
create policy "Users can insert own runs" on public.runs for insert with check (auth.uid() = user_id);
create policy "Users can update own runs" on public.runs for update using (auth.uid() = user_id);
create policy "Public runs readable by anyone" on public.runs for select using (is_public = true);

-- api_keys: personal API keys for CLI push
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  key_hash text not null unique,
  label text,
  last_used_at timestamptz,
  created_at timestamptz default now()
);
alter table public.api_keys enable row level security;
create policy "Users can read own keys" on public.api_keys for select using (auth.uid() = user_id);
create policy "Users can insert own keys" on public.api_keys for insert with check (auth.uid() = user_id);
create policy "Users can delete own keys" on public.api_keys for delete using (auth.uid() = user_id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
