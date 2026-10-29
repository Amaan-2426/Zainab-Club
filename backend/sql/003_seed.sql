-- Seed catalogue from the existing ZAINAB CLUB HTML pages.
-- Prices match the frontend. Stock is UNCONFIRMED (NULL) until you fill it in.
--
-- Colour / size notes from the live HTML (please confirm):
-- Graphic tee colour button label is "Light Brown" but data-colour="red". Seed uses Light Brown.
-- Oversized tee button label is "Red" but data-colour="Black". Seed uses Red (what the shopper sees).
-- Trackpant XXL button currently has data-size="XL" in HTML. Seed uses real size XXL.

insert into products (
  id, slug, name, category, description, price_rupees, detail_page, media_path, is_active
) values
  (
    '11111111-1111-4111-8111-111111111111',
    'everyday-essential-trackpant',
    'Everyday Essential Trackpant',
    'mens_clothing',
    'An everyday essential designed for comfortable and effortless styling.',
    450,
    'product.html',
    'trackpant.mp4',
    true
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'graphic-print-tshirt',
    'Graphic Print T-shirt',
    'mens_clothing',
    'A graphic-print essential for effortless everyday streetwear.',
    250,
    'graphic-tshirt.html',
    'beige.mp4',
    true
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'oversized-streetwear-tshirt',
    'Oversized Streetwear T-shirt',
    'mens_clothing',
    'A relaxed oversized fit made for everyday streetwear and effortless styling.',
    250,
    'oversized-tshirt.html',
    'hero.polo.mp4',
    true
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    'black-bead-necklace-earrings-set',
    'Black-Bead Necklace & Earrings Set',
    'womens_jewellery',
    'A stylish black-bead jewellery set featuring a matching necklace and earrings, perfect for everyday styling. Includes 1 necklace + matching earrings.',
    250,
    'black-jewellery.html',
    'blacknecklace1.mp4',
    true
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'green-bead-necklace-earrings-set',
    'Green-Bead Necklace & Earrings Set',
    'womens_jewellery',
    'A distinctive green-bead jewellery set with a matching necklace and earrings, designed to add colour to your look. Includes 1 necklace + matching earrings.',
    250,
    'green-jewellery.html',
    'green 1.mp4',
    true
  )
on conflict (id) do nothing;

-- Trackpant: S, M, L, XL, XXL x Black, Brown, Olive Green
insert into product_variants (id, product_id, size, colour, sku, is_active) values
  ('a1111111-0001-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'S', 'Black', 'ZC-TRACK-S-BLACK', true),
  ('a1111111-0002-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'M', 'Black', 'ZC-TRACK-M-BLACK', true),
  ('a1111111-0003-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'L', 'Black', 'ZC-TRACK-L-BLACK', true),
  ('a1111111-0004-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'XL', 'Black', 'ZC-TRACK-XL-BLACK', true),
  ('a1111111-0005-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'XXL', 'Black', 'ZC-TRACK-XXL-BLACK', true),
  ('a1111111-0006-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'S', 'Brown', 'ZC-TRACK-S-BROWN', true),
  ('a1111111-0007-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'M', 'Brown', 'ZC-TRACK-M-BROWN', true),
  ('a1111111-0008-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111', 'L', 'Brown', 'ZC-TRACK-L-BROWN', true),
  ('a1111111-0009-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'XL', 'Brown', 'ZC-TRACK-XL-BROWN', true),
  ('a1111111-0010-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111', 'XXL', 'Brown', 'ZC-TRACK-XXL-BROWN', true),
  ('a1111111-0011-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111', 'S', 'Olive Green', 'ZC-TRACK-S-OLIVE', true),
  ('a1111111-0012-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111', 'M', 'Olive Green', 'ZC-TRACK-M-OLIVE', true),
  ('a1111111-0013-4000-8000-000000000013', '11111111-1111-4111-8111-111111111111', 'L', 'Olive Green', 'ZC-TRACK-L-OLIVE', true),
  ('a1111111-0014-4000-8000-000000000014', '11111111-1111-4111-8111-111111111111', 'XL', 'Olive Green', 'ZC-TRACK-XL-OLIVE', true),
  ('a1111111-0015-4000-8000-000000000015', '11111111-1111-4111-8111-111111111111', 'XXL', 'Olive Green', 'ZC-TRACK-XXL-OLIVE', true)
on conflict (id) do nothing;

-- Graphic tee: S, M x Black, Light Brown (from product page labels)
insert into product_variants (id, product_id, size, colour, sku, is_active) values
  ('a2222222-0001-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'S', 'Black', 'ZC-GRAPHIC-S-BLACK', true),
  ('a2222222-0002-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'M', 'Black', 'ZC-GRAPHIC-M-BLACK', true),
  ('a2222222-0003-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'S', 'Light Brown', 'ZC-GRAPHIC-S-LIGHTBROWN', true),
  ('a2222222-0004-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'M', 'Light Brown', 'ZC-GRAPHIC-M-LIGHTBROWN', true)
on conflict (id) do nothing;

-- Oversized tee: S, M x Red (from visible button label)
insert into product_variants (id, product_id, size, colour, sku, is_active) values
  ('a3333333-0001-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'S', 'Red', 'ZC-OVERSIZE-S-RED', true),
  ('a3333333-0002-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'M', 'Red', 'ZC-OVERSIZE-M-RED', true)
on conflict (id) do nothing;

-- Jewellery: one default variant each (no size/colour on the pages)
insert into product_variants (id, product_id, size, colour, sku, is_active) values
  ('a4444444-0001-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', null, null, 'ZC-JEWEL-BLACK-SET', true),
  ('a5555555-0001-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', null, null, 'ZC-JEWEL-GREEN-SET', true)
on conflict (id) do nothing;

-- UNCONFIRMED STOCK: quantity is NULL on purpose.
-- After you know real numbers, run something like:
--   update inventory set quantity = 10 where variant_id = '...';
insert into inventory (variant_id, quantity)
select id, null
from product_variants
on conflict (variant_id) do nothing;
