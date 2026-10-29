
const CART_KEY = "zainabCart";

function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY)) || [];
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function addToZainabCart(newItem) {
  const cart = getCart();

  const size = newItem.size ?? newItem.variant?.size ?? null;
  const colour = newItem.colour ?? newItem.variant?.colour ?? null;
  const price = Number(newItem.priceRupees ?? newItem.price ?? 0);

  const quantity = Number(newItem.quantity) || 1;

  const variantId =
    newItem.variantId ??
    newItem.variant?.id ??
    findVariantId(newItem.name, size, colour);

  const productId =
    newItem.productId ??
    newItem.id ??
    findProductId(newItem.name);

  const existing = cart.find(function (item) {
    if (variantId && item.variantId) {
      return item.variantId === variantId;
    }

    return (
      item.name === newItem.name &&
      (item.size ?? item.variant?.size ?? null) === size &&
      (item.colour ?? item.variant?.colour ?? null) === colour
    );
  });

  if (existing) {
    existing.quantity = (Number(existing.quantity) || 1) + quantity;
    existing.price = price;
    existing.priceRupees = price;

    if (variantId) existing.variantId = variantId;
    if (productId) existing.productId = productId;
  } else {
    cart.push({
      name: newItem.name,
      price: price,
      priceRupees: price,
      size: size,
      colour: colour,
      variant: newItem.variant ?? null,
      quantity: quantity,
      productId: productId,
      variantId: variantId,
      mediaPath: newItem.mediaPath ?? null
    });
  }

  saveCart(cart);
  return cart;
}
