-- Row Level Security
-- Run after 001_schema.sql
--
-- The Express server uses the service role key (bypasses RLS) for:
--   public product reads, placing orders, and admin work.
-- These policies protect you if the anon key is ever used in a browser:
-- visitors can read the catalogue, but cannot read other people's orders.

alter table products enable row level security;
alter table product_variants enable row level security;
alter table inventory enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

drop policy if exists products_public_read on products;
create policy products_public_read
  on products for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists variants_public_read on product_variants;
create policy variants_public_read
  on product_variants for select
  to anon, authenticated
  using (is_active = true);

-- Stock numbers are not public. The API can still return availability via service role.
drop policy if exists inventory_no_public_read on inventory;
create policy inventory_no_public_read
  on inventory for select
  to anon, authenticated
  using (false);

drop policy if exists orders_no_public_read on orders;
create policy orders_no_public_read
  on orders for select
  to anon, authenticated
  using (false);

drop policy if exists order_items_no_public_read on order_items;
create policy order_items_no_public_read
  on order_items for select
  to anon, authenticated
  using (false);

-- No insert/update/delete policies for anon or authenticated.
-- Writes happen only through the Express server (service role) or the place_order function.
