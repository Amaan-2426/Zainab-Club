// IDs match backend/sql/003_seed.sql so checkout can work even if older cart rows
// only stored name + size + colour.

const CATALOGUE = [
  {
    name: "Everyday Essential Trackpant",
    productId: "11111111-1111-4111-8111-111111111111",
    variants: [
      ["S", "Black", "a1111111-0001-4000-8000-000000000001"],
      ["M", "Black", "a1111111-0002-4000-8000-000000000002"],
      ["L", "Black", "a1111111-0003-4000-8000-000000000003"],
      ["XL", "Black", "a1111111-0004-4000-8000-000000000004"],
      ["XXL", "Black", "a1111111-0005-4000-8000-000000000005"],
      ["S", "Brown", "a1111111-0006-4000-8000-000000000006"],
      ["M", "Brown", "a1111111-0007-4000-8000-000000000007"],
      ["L", "Brown", "a1111111-0008-4000-8000-000000000008"],
      ["XL", "Brown", "a1111111-0009-4000-8000-000000000009"],
      ["XXL", "Brown", "a1111111-0010-4000-8000-000000000010"],
      ["S", "Olive Green", "a1111111-0011-4000-8000-000000000011"],
      ["M", "Olive Green", "a1111111-0012-4000-8000-000000000012"],
      ["L", "Olive Green", "a1111111-0013-4000-8000-000000000013"],
      ["XL", "Olive Green", "a1111111-0014-4000-8000-000000000014"],
      ["XXL", "Olive Green", "a1111111-0015-4000-8000-000000000015"]
    ]
  },
  {
    name: "Graphic Print T-shirt",
    productId: "22222222-2222-4222-8222-222222222222",
    variants: [
      ["S", "Black", "a2222222-0001-4000-8000-000000000001"],
      ["M", "Black", "a2222222-0002-4000-8000-000000000002"],
      ["S", "Light Brown", "a2222222-0003-4000-8000-000000000003"],
      ["M", "Light Brown", "a2222222-0004-4000-8000-000000000004"]
    ]
  },
  {
    name: "Oversized Streetwear T-shirt",
    productId: "33333333-3333-4333-8333-333333333333",
    variants: [
      ["S", "Red", "a3333333-0001-4000-8000-000000000001"],
      ["M", "Red", "a3333333-0002-4000-8000-000000000002"]
    ]
  },
  {
    name: "Black-Bead Necklace & Earrings Set",
    productId: "44444444-4444-4444-8444-444444444444",
    variants: [[null, null, "a4444444-0001-4000-8000-000000000001"]]
  },
  {
    name: "Green-Bead Necklace & Earrings Set",
    productId: "55555555-5555-4555-8555-555555555555",
    variants: [[null, null, "a5555555-0001-4000-8000-000000000001"]]
  }
];

function findVariantId(name, size, colour) {
  const product = CATALOGUE.find((item) => item.name === name);
  if (!product) return null;

  const match = product.variants.find((row) => {
    const rowSize = row[0];
    const rowColour = row[1];
    if (rowSize == null && rowColour == null) return true;
    return rowSize === size && rowColour === colour;
  });

  return match ? match[2] : null;
}

function findProductId(name) {
  const product = CATALOGUE.find((item) => item.name === name);
  return product ? product.productId : null;
}
