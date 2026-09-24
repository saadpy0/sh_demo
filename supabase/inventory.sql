-- Inventory overlay for Singapore Hardware (Module 2).
-- Variant stock is keyed to catalog product + finish + size + color.
-- Demo UI currently persists in localStorage; run this when moving to Supabase.

create table if not exists stock_skus (
  sku text primary key,
  product_id integer references products(id) on delete set null,
  catalog_code text not null,
  item_name text not null,
  supplier text not null default '',
  finish text not null default '',
  size text not null default '',
  color text not null default '',
  on_hand numeric(12,2) not null default 0,
  reserved numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stock_skus_variant_idx
  on stock_skus (coalesce(product_id, 0), catalog_code, finish, size, color);

create table if not exists stock_movements (
  id bigint generated always as identity primary key,
  sku text not null references stock_skus(sku) on delete cascade,
  catalog_code text not null,
  type text not null check (type in ('inward','outward','return','adjust','reserve','release','confirm')),
  qty numeric(12,2) not null,
  reason text not null default '',
  ref text not null default '',
  author text not null default '',
  at timestamptz not null default now()
);

create index if not exists stock_movements_sku_at_idx on stock_movements (sku, at desc);

create table if not exists stock_holds (
  quotation_id integer primary key,
  voucher_no text not null,
  ship_to_name text not null,
  status text not null check (status in ('reserved','confirmed','cancelled')),
  lines jsonb not null default '[]'::jsonb,
  at timestamptz not null default now()
);
