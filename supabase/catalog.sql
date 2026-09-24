-- Catalog + quotation tables for Singapore Hardwares.
-- Run this on a NEW Supabase project, then:
--   npm run catalog:import
-- Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

create extension if not exists pg_trgm;

create table if not exists suppliers (
  id integer primary key,
  name text not null unique
);

create table if not exists catalogs (
  id integer primary key,
  supplier_id integer not null references suppliers(id),
  name text not null,
  unique (supplier_id, name)
);

create table if not exists categories (
  id integer primary key,
  catalog_id integer not null references catalogs(id) on delete cascade,
  name text not null,
  unique (catalog_id, name)
);

create table if not exists collections (
  id integer primary key,
  catalog_id integer not null references catalogs(id) on delete cascade,
  category_id integer references categories(id) on delete set null,
  name text not null
);

create unique index if not exists collections_scope_key
  on collections (catalog_id, coalesce(category_id, 0), name);

create table if not exists products (
  id integer primary key,
  catalog_id integer not null references catalogs(id) on delete cascade,
  collection_id integer references collections(id) on delete set null,
  code text not null,
  item_name text not null,
  confidence text not null default 'HIGH',
  review_notes text,
  size_mm text,
  size_inch text,
  color_options text,
  search_text text not null default ''
);

create table if not exists product_prices (
  id integer primary key,
  product_id integer not null references products(id) on delete cascade,
  finish text not null,
  price numeric(12,2),
  currency text not null default 'INR',
  confidence text not null default 'HIGH',
  review_notes text,
  size_mm text not null default '',
  size_inch text not null default '',
  unique (product_id, finish, size_mm, size_inch)
);

create table if not exists quotations (
  id integer generated always as identity primary key,
  voucher_no text not null unique,
  quotation_date date not null default current_date,
  ship_to_name text not null,
  ship_to_address text,
  ship_to_contact text not null,
  ship_to_email text,
  bill_to_name text not null,
  bill_to_address text,
  bill_to_contact text not null,
  bill_to_email text,
  hide_discount boolean not null default false,
  packaging_forwarding numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists quotation_items (
  id integer generated always as identity primary key,
  quotation_id integer not null references quotations(id) on delete cascade,
  product_id integer references products(id) on delete set null,
  code text not null,
  item_name text not null,
  collection text,
  finish text not null,
  exact_finish text,
  size text,
  color text,
  hsn_sac text,
  unit_price numeric(12,2) not null,
  currency text not null default 'INR',
  quantity integer not null,
  discount_pct numeric(5,2) not null default 0,
  gst_pct numeric(5,2) not null default 18,
  line_amount numeric(12,2) not null
);

create index if not exists products_catalog_idx on products(catalog_id);
create index if not exists products_collection_idx on products(collection_id);
create index if not exists products_code_idx on products(code);
create index if not exists products_search_trgm on products using gin (search_text gin_trgm_ops);
create index if not exists prices_product_idx on product_prices(product_id);
create index if not exists quotation_items_quote_idx on quotation_items(quotation_id);

create or replace function refresh_product_search_text()
returns trigger
language plpgsql
as $$
declare
  col_name text := '';
  cat_name text := '';
  brand text := '';
  finishes text := '';
begin
  if new.collection_id is not null then
    select c.name, coalesce(cat.name, '') into col_name, cat_name
    from collections c
    left join categories cat on cat.id = c.category_id
    where c.id = new.collection_id;
  end if;
  select s.name into brand
  from catalogs cat
  join suppliers s on s.id = cat.supplier_id
  where cat.id = new.catalog_id;
  select string_agg(distinct finish, ' ') into finishes
  from product_prices
  where product_id = new.id;
  new.search_text := lower(concat_ws(' ',
    brand, cat_name, col_name, new.code, new.item_name,
    new.size_mm, new.size_inch, new.review_notes, finishes
  ));
  return new;
end;
$$;

drop trigger if exists products_search_text on products;
create trigger products_search_text
before insert or update on products
for each row execute function refresh_product_search_text();

alter table suppliers enable row level security;
alter table catalogs enable row level security;
alter table categories enable row level security;
alter table collections enable row level security;
alter table products enable row level security;
alter table product_prices enable row level security;
alter table quotations enable row level security;
alter table quotation_items enable row level security;

-- Demo: catalog is readable with the anon key. Quotes can be written
-- with the anon key until staff auth is wired.
drop policy if exists catalog_read_suppliers on suppliers;
create policy catalog_read_suppliers on suppliers for select using (true);
drop policy if exists catalog_read_catalogs on catalogs;
create policy catalog_read_catalogs on catalogs for select using (true);
drop policy if exists catalog_read_categories on categories;
create policy catalog_read_categories on categories for select using (true);
drop policy if exists catalog_read_collections on collections;
create policy catalog_read_collections on collections for select using (true);
drop policy if exists catalog_read_products on products;
create policy catalog_read_products on products for select using (true);
drop policy if exists catalog_read_prices on product_prices;
create policy catalog_read_prices on product_prices for select using (true);

drop policy if exists quotes_read on quotations;
create policy quotes_read on quotations for select using (true);
drop policy if exists quotes_insert on quotations;
create policy quotes_insert on quotations for insert with check (true);
drop policy if exists quotes_update on quotations;
create policy quotes_update on quotations for update using (true);
drop policy if exists quote_items_read on quotation_items;
create policy quote_items_read on quotation_items for select using (true);
drop policy if exists quote_items_insert on quotation_items;
create policy quote_items_insert on quotation_items for insert with check (true);
drop policy if exists quote_items_delete on quotation_items;
create policy quote_items_delete on quotation_items for delete using (true);
