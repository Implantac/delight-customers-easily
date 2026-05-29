
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Companies
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  website text,
  industry text,
  size text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.companies(user_id);
grant select, insert, update, delete on public.companies to authenticated;
grant all on public.companies to service_role;
alter table public.companies enable row level security;
create policy "companies_all_own" on public.companies for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger companies_updated before update on public.companies for each row execute function public.set_updated_at();

-- Contacts
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  email text,
  phone text,
  position text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.contacts(user_id);
create index on public.contacts(company_id);
grant select, insert, update, delete on public.contacts to authenticated;
grant all on public.contacts to service_role;
alter table public.contacts enable row level security;
create policy "contacts_all_own" on public.contacts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger contacts_updated before update on public.contacts for each row execute function public.set_updated_at();

-- Deal stage enum
create type public.deal_stage as enum ('lead','qualified','proposal','negotiation','won','lost');

-- Deals
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  value numeric(12,2) not null default 0,
  stage public.deal_stage not null default 'lead',
  expected_close date,
  notes text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.deals(user_id);
create index on public.deals(stage);
grant select, insert, update, delete on public.deals to authenticated;
grant all on public.deals to service_role;
alter table public.deals enable row level security;
create policy "deals_all_own" on public.deals for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger deals_updated before update on public.deals for each row execute function public.set_updated_at();

-- Activity type enum
create type public.activity_type as enum ('call','email','meeting','task','note');

-- Activities
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  type public.activity_type not null default 'task',
  title text not null,
  description text,
  due_date timestamptz,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.activities(user_id);
create index on public.activities(due_date);
grant select, insert, update, delete on public.activities to authenticated;
grant all on public.activities to service_role;
alter table public.activities enable row level security;
create policy "activities_all_own" on public.activities for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger activities_updated before update on public.activities for each row execute function public.set_updated_at();
