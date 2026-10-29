
const form = document.getElementById("checkout-form");
const summary = document.getElementById("checkout-summary");
const message = document.getElementById("checkout-message");

function cartLinesForServer(cart) {
  return cart.map(function (item) {
    const size = item.size ?? item.variant?.size ?? null;
    const colour = item.colour ?? item.variant?.colour ?? null;

    const variantId =
      item.variantId || findVariantId(item.name, size, colour);

    return {
      variant_id: variantId,
      quantity: item.quantity || 1,
      name: item.name
    };
  });
}

function renderSummary() {
  const cart = getCart();

  if (!cart.length) {
    summary.innerHTML =
      "<p class='empty-cart'>Your cart is empty.</p>";
    form.hidden = true;
    return;
  }

  form.hidden = false;

  const displayTotal = cart.reduce(function (sum, item) {
    const price = Number(item.priceRupees ?? item.price ?? 0);
    return sum + price * (item.quantity || 1);
  }, 0);

  summary.innerHTML =
    "<p>Items in bag: " +
    cart.length +
    "</p><p>Displayed bag total: ₹" +
    displayTotal +
    " (the server will recalculate the real total)</p>";
}

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  message.textContent = "Placing your order…";

  const cart = getCart();

  if (!cart.length) {
    message.textContent = "Your cart is empty.";
    return;
  }

  const items = cartLinesForServer(cart);

  const missing = items.find(function (item) {
    return !item.variant_id;
  });

  if (missing) {
    message.textContent =
      'Could not match "' +
      missing.name +
      '" to a product variant. Please remove it and add it again from the product page.';
    return;
  }

  const payload = {
    customer: {
      name: form.elements.namedItem("name").value.trim(),
      email: form.elements.namedItem("email").value.trim(),
      phone: form.elements.namedItem("phone").value.trim(),
      address_line1: form.elements.namedItem("address_line1").value.trim(),
      address_line2: form.elements.namedItem("address_line2").value.trim(),
      city: form.elements.namedItem("city").value.trim(),
      state: form.elements.namedItem("state").value.trim(),
      postal_code: form.elements.namedItem("postal_code").value.trim(),
      notes: form.elements.namedItem("notes").value.trim()
    },
    items: items.map(function (item) {
      return {
        variant_id: item.variant_id,
        quantity: item.quantity
      };
    })
  };

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const data = await apiRequest("/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const successUrl =
      "order-success.html?orderId=" +
      encodeURIComponent(data.orderId) +
      "&accessToken=" +
      encodeURIComponent(data.accessToken) +
      "&subtotalRupees=" +
      encodeURIComponent(data.subtotalRupees);

    // Clear the cart only after the server successfully creates the order.
    localStorage.removeItem("zainabCart");

    window.location.href = successUrl;
  } catch (error) {
    const extra = error.payload?.error?.details
      ? " " + error.payload.error.details.join(" ")
      : "";

    message.textContent = error.message + extra;
    submitButton.disabled = false;
  }
});

renderSummary();
