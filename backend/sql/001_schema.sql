-- ZAINAB CLUB schema
-- Run this first in the Supabase SQL editor (or psql).

create extension if not exists pgcrypto;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (category in ('mens_clothing', 'womens_jewellery')),
  description text,
  -- Display / catalogue price in whole rupees. Orders never trust the browser for this.
  price_rupees integer not null check (price_rupees > 0),
  detail_page text,
  media_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  size text,
  colour text,
  sku text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One inventory row per variant.
-- quantity NULL means stock is UNCONFIRMED (not yet filled in).
-- The place_order function will not invent a number; it will skip decrement until you set stock.
create table if not exists inventory (
  variant_id uuid primary key references product_variants(id) on delete cascade,
  quantity integer check (quantity is null or quantity >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  -- Customer lookup secret. Returned when the order is created. Not listed publicly.
  access_token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'confirmed', 'cancelled', 'fulfilled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid')),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'IN',
  notes text,
  subtotal_rupees integer not null check (subtotal_rupees >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  variant_id uuid not null references product_variants(id),
  product_name text not null,
  size text,
  colour text,
  quantity integer not null check (quantity > 0),
  unit_price_rupees integer not null check (unit_price_rupees >= 0),
  line_total_rupees integer not null check (line_total_rupees >= 0)
);

create index if not exists idx_product_variants_product_id on product_variants(product_id);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_orders_customer_email on orders(customer_email);

-- Unique size+colour per product. Jewellery uses one row with null size and colour.
create unique index if not exists idx_variants_product_size_colour
  on product_variants (
    product_id,
    coalesce(size, ''),
    coalesce(colour, '')
  );

-- Atomic checkout: lock inventory, price from products table, insert order + items.
create or replace function place_order(p_customer jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_access uuid;
  v_subtotal integer := 0;
  v_item jsonb;
  v_variant_id uuid;
  v_qty integer;
  v_product_id uuid;
  v_product_name text;
  v_size text;
  v_colour text;
  v_price integer;
  v_active boolean;
  v_stock integer;
  v_email text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'CART_EMPTY' using errcode = 'P0001';
  end if;

  -- Combine the same variant so 2 + 3 items cannot sneak past a stock of 4.
  select jsonb_agg(jsonb_build_object('variant_id', variant_id, 'quantity', quantity))
  into p_items
  from (
    select
      value->>'variant_id' as variant_id,
      sum((value->>'quantity')::integer) as quantity
    from jsonb_array_elements(p_items)
    group by value->>'variant_id'
  ) grouped;

  v_email := lower(trim(p_customer->>'email'));

  if coalesce(trim(p_customer->>'name'), '') = ''
     or coalesce(v_email, '') = ''
     or v_email !~ '^[^@]+@[^@]+\.[^@]+$'
     or coalesce(trim(p_customer->>'phone'), '') = ''
     or coalesce(trim(p_customer->>'address_line1'), '') = ''
     or coalesce(trim(p_customer->>'city'), '') = ''
     or coalesce(trim(p_customer->>'state'), '') = ''
     or coalesce(trim(p_customer->>'postal_code'), '') = '' then
    raise exception 'INVALID_CUSTOMER' using errcode = 'P0001';
  end if;

  -- First pass: lock rows and compute totals. Do not trust client prices.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_variant_id := (v_item->>'variant_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'INVALID_VARIANT' using errcode = 'P0001';
    end;

    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 20 then
      raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
    end if;

    select
      pv.product_id,
      p.name,
      pv.size,
      pv.colour,
      p.price_rupees,
      (pv.is_active and p.is_active),
      i.quantity
    into
      v_product_id,
      v_product_name,
      v_size,
      v_colour,
      v_price,
      v_active,
      v_stock
    from product_variants pv
    join products p on p.id = pv.product_id
    join inventory i on i.variant_id = pv.id
    where pv.id = v_variant_id
    for update of i;

    if not found then
      raise exception 'VARIANT_NOT_FOUND' using errcode = 'P0001';
    end if;

    if v_active is not true then
      raise exception 'VARIANT_UNAVAILABLE' using errcode = 'P0001';
    end if;

    -- Only enforce stock when you have entered a real quantity.
    if v_stock is not null and v_stock < v_qty then
      raise exception 'INSUFFICIENT_STOCK' using errcode = 'P0001';
    end if;

    v_subtotal := v_subtotal + (v_price * v_qty);
  end loop;

  insert into orders (
    customer_name,
    customer_email,
    customer_phone,
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    country,
    notes,
    subtotal_rupees,
    status,
    payment_status
  ) values (
    trim(p_customer->>'name'),
    v_email,
    trim(p_customer->>'phone'),
    trim(p_customer->>'address_line1'),
    nullif(trim(p_customer->>'address_line2'), ''),
    trim(p_customer->>'city'),
    trim(p_customer->>'state'),
    trim(p_customer->>'postal_code'),
    coalesce(nullif(trim(p_customer->>'country'), ''), 'IN'),
    nullif(trim(p_customer->>'notes'), ''),
    v_subtotal,
    'pending_payment',
    'unpaid'
  )
  returning id, access_token into v_order_id, v_access;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    select
      pv.product_id,
      p.name,
      pv.size,
      pv.colour,
      p.price_rupees,
      i.quantity
    into
      v_product_id,
      v_product_name,
      v_size,
      v_colour,
      v_price,
      v_stock
    from product_variants pv
    join products p on p.id = pv.product_id
    join inventory i on i.variant_id = pv.id
    where pv.id = v_variant_id
    for update of i;

    insert into order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      size,
      colour,
      quantity,
      unit_price_rupees,
      line_total_rupees
    ) values (
      v_order_id,
      v_product_id,
      v_variant_id,
      v_product_name,
      v_size,
      v_colour,
      v_qty,
      v_price,
      v_price * v_qty
    );

    if v_stock is not null then
      update inventory
      set quantity = quantity - v_qty,
          updated_at = now()
      where variant_id = v_variant_id;
    end if;
  end loop;

  return jsonb_build_object(
    'id', v_order_id,
    'access_token', v_access,
    'subtotal_rupees', v_subtotal,
    'status', 'pending_payment',
    'payment_status', 'unpaid'
  );
end;
$$;

revoke all on function place_order(jsonb, jsonb) from public;
revoke all on function place_order(jsonb, jsonb) from anon;
revoke all on function place_order(jsonb, jsonb) from authenticated;
-- service_role keeps access by default in Supabase
