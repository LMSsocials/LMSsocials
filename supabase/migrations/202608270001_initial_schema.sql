create extension if not exists pgcrypto;
create type public.order_status as enum ('pending','processing','completed','cancelled','refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.order_status not null default 'pending',
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  service_type text not null check (service_type in ('boosting','logs','numbers')),
  title text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index orders_user_created_idx on public.orders (user_id,created_at desc);
create index order_items_order_idx on public.order_items (order_id);

create function public.set_updated_at() returns trigger language plpgsql
set search_path = '' as $$ begin new.updated_at=now(); return new; end; $$;
create trigger profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();
create trigger orders_updated before update on public.orders
for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
 insert into public.profiles(id,full_name)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''));
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
