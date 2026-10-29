const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{8,20}$/;
const POSTAL_RE = /^[0-9A-Za-z\-\s]{3,12}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

function requiredString(value, field, min = 1, max = 120) {
  if (typeof value !== "string") return `${field} is required.`;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    return `${field} must be between ${min} and ${max} characters.`;
  }
  return null;
}

export function validateOrderPayload(body) {
  const errors = [];
  if (!body || typeof body !== "object") {
    return { ok: false, errors: ["Request body must be JSON."] };
  }

  const customer = body.customer || {};
  const items = body.items;

  const nameErr = requiredString(customer.name, "customer.name", 2, 80);
  if (nameErr) errors.push(nameErr);

  if (typeof customer.email !== "string" || !EMAIL_RE.test(customer.email.trim())) {
    errors.push("customer.email must be a valid email address.");
  }

  if (typeof customer.phone !== "string" || !PHONE_RE.test(customer.phone.trim())) {
    errors.push("customer.phone must be a valid phone number.");
  }

  const a1 = requiredString(customer.address_line1, "customer.address_line1", 5, 160);
  if (a1) errors.push(a1);

  if (customer.address_line2 != null && String(customer.address_line2).length > 160) {
    errors.push("customer.address_line2 is too long.");
  }

  const cityErr = requiredString(customer.city, "customer.city", 2, 80);
  if (cityErr) errors.push(cityErr);

  const stateErr = requiredString(customer.state, "customer.state", 2, 80);
  if (stateErr) errors.push(stateErr);

  if (typeof customer.postal_code !== "string" || !POSTAL_RE.test(customer.postal_code.trim())) {
    errors.push("customer.postal_code is invalid.");
  }

  if (customer.notes != null && String(customer.notes).length > 500) {
    errors.push("customer.notes is too long.");
  }

  // Prices and totals from the browser are ignored on purpose.
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("items must be a non-empty array.");
  } else if (items.length > 30) {
    errors.push("Too many items in one order.");
  } else {
    items.forEach((item, index) => {
      if (!item || !isUuid(item.variant_id)) {
        errors.push(`items[${index}].variant_id must be a valid id.`);
      }
      const qty = item.quantity;
      if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
        errors.push(`items[${index}].quantity must be a whole number from 1 to 20.`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

export function validateAdminProduct(body, { partial = false } = {}) {
  const errors = [];
  const allowedCategory = ["mens_clothing", "womens_jewellery"];

  if (!partial) {
    if (requiredString(body?.name, "name", 2, 120)) errors.push(requiredString(body.name, "name", 2, 120));
    if (requiredString(body?.slug, "slug", 2, 80)) errors.push(requiredString(body.slug, "slug", 2, 80));
    if (!allowedCategory.includes(body?.category)) {
      errors.push("category must be mens_clothing or womens_jewellery.");
    }
    if (!Number.isInteger(body?.price_rupees) || body.price_rupees < 1) {
      errors.push("price_rupees must be a whole number greater than 0.");
    }
  } else {
    if (body.name != null && requiredString(body.name, "name", 2, 120)) {
      errors.push(requiredString(body.name, "name", 2, 120));
    }
    if (body.slug != null && requiredString(body.slug, "slug", 2, 80)) {
      errors.push(requiredString(body.slug, "slug", 2, 80));
    }
    if (body.category != null && !allowedCategory.includes(body.category)) {
      errors.push("category must be mens_clothing or womens_jewellery.");
    }
    if (body.price_rupees != null && (!Number.isInteger(body.price_rupees) || body.price_rupees < 1)) {
      errors.push("price_rupees must be a whole number greater than 0.");
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateAdminInventory(body) {
  if (!body || !("quantity" in body)) {
    return { ok: false, errors: ["quantity is required. Use a whole number, or null if still unconfirmed."] };
  }
  if (body.quantity !== null && (!Number.isInteger(body.quantity) || body.quantity < 0)) {
    return { ok: false, errors: ["quantity must be null or a whole number 0 or more."] };
  }
  return { ok: true, errors: [] };
}
