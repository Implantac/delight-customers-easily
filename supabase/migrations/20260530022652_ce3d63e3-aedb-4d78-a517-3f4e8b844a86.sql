create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  bank_name text,
  account_number text,
  currency text not null default 'BRL',
  opening_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bank_accounts_org_idx on public.bank_accounts(organization_id);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  occurred_at date not null,
  description text not null,
  amount numeric(14,2) not null,
  counterparty text,
  category text,
  reconciled boolean not null default false,
  invoice_id uuid,
  expense_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bank_tx_org_idx on public.bank_transactions(organization_id);
create index if not exists bank_tx_acc_idx on public.bank_transactions(account_id, occurred_at desc);
create index if not exists bank_tx_recon_idx on public.bank_transactions(organization_id, reconciled);

grant select, insert, update, delete on public.bank_accounts to authenticated;
grant all on public.bank_accounts to service_role;
grant select, insert, update, delete on public.bank_transactions to authenticated;
grant all on public.bank_transactions to service_role;

alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;

create policy "bank_accounts org members select" on public.bank_accounts for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));
create policy "bank_accounts org members insert" on public.bank_accounts for insert to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));
create policy "bank_accounts org members update" on public.bank_accounts for update to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
create policy "bank_accounts admins delete" on public.bank_accounts for delete to authenticated
  using (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]));

create policy "bank_tx org members select" on public.bank_transactions for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));
create policy "bank_tx org members insert" on public.bank_transactions for insert to authenticated
  with check (public.is_org_member(organization_id, auth.uid()));
create policy "bank_tx org members update" on public.bank_transactions for update to authenticated
  using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));
create policy "bank_tx admins delete" on public.bank_transactions for delete to authenticated
  using (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]));

create or replace function public.touch_updated_at_bank()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists bank_accounts_touch on public.bank_accounts;
create trigger bank_accounts_touch before update on public.bank_accounts
  for each row execute function public.touch_updated_at_bank();
drop trigger if exists bank_tx_touch on public.bank_transactions;
create trigger bank_tx_touch before update on public.bank_transactions
  for each row execute function public.touch_updated_at_bank();