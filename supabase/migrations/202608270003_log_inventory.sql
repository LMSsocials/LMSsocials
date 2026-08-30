create type public.log_source as enum ('managed','bulkacc');

create table public.log_products (
 id uuid primary key default gen_random_uuid(),
 source public.log_source not null default 'managed',
 supplier_code text unique,
 platform text not null,
 title text not null,
 description text not null default '',
 price_ngn numeric(12,2) not null check(price_ngn>=0),
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.log_inventory_items (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.log_products(id) on delete cascade,
 account_data text not null,
 sold_at timestamptz,
 order_id uuid references public.orders(id),
 created_at timestamptz not null default now()
);

create index log_products_platform_idx on public.log_products(platform,is_active);
create index log_inventory_available_idx on public.log_inventory_items(product_id) where sold_at is null;

alter table public.log_products enable row level security;
alter table public.log_inventory_items enable row level security;

create policy read_active_log_products on public.log_products for select
using (is_active=true);

-- Inventory credentials intentionally have no browser-readable policy.
-- Uploads, sales and delivery must run through authenticated server/admin APIs.
