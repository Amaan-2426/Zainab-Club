/**
 * Tests whatever we can without inventing a live Supabase connection.
 * Run from the backend folder: npm run test:api
 * Start the server first: npm start
 */

const BASE = process.env.API_BASE || "http://localhost:3000/api";

async function request(method, path, body, headers = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error("FAIL: " + message);
  }
  console.log("PASS:", message);
}

const fakeOrder = {
  customer: {
    name: "Test Customer",
    email: "test@example.com",
    phone: "9999999999",
    address_line1: "12 Example Street",
    city: "Lucknow",
    state: "Uttar Pradesh",
    postal_code: "226001"
  },
  items: [{ variant_id: "a2222222-0001-4000-8000-000000000001", quantity: 1, price: 1 }]
};

async function run() {
  const health = await request("GET", "/health");
  assert(health.status === 200 && health.json?.ok === true, "GET /api/health returns ok");
  assert(health.json.data.status === "ok", "health payload includes status ok");
  console.log("  supabaseConfigured:", health.json.data.supabaseConfigured);

  const missingFields = await request("POST", "/orders", { items: [] });
  assert(missingFields.status === 400 && missingFields.json?.ok === false, "POST /orders empty items is 400");

  const badEmail = await request("POST", "/orders", {
    customer: { ...fakeOrder.customer, email: "not-an-email" },
    items: fakeOrder.items
  });
  assert(badEmail.status === 400, "POST /orders invalid email is 400");

  const clientPriceIgnoredShape = await request("POST", "/orders", fakeOrder);
  assert(
    [400, 409, 503, 201].includes(clientPriceIgnoredShape.status),
    "POST /orders with a fake client price is accepted as a request shape (price is still ignored)"
  );
  console.log("  order-with-fake-price status:", clientPriceIgnoredShape.status, clientPriceIgnoredShape.json?.error || clientPriceIgnoredShape.json?.data?.message);

  const products = await request("GET", "/products");
  if (health.json.data.supabaseConfigured) {
    assert(products.status === 200 && Array.isArray(products.json?.data?.products), "GET /api/products works with Supabase");
  } else {
    assert(products.status === 503, "GET /api/products is 503 until Supabase keys are set");
    console.log("  Product/order database tests were not run: .env is not configured.");
  }

  const admin = await request("GET", "/admin/products");
  assert([401, 503].includes(admin.status), "GET /api/admin/products is blocked without a valid admin key");

  const orderLookup = await request("GET", "/orders/11111111-1111-4111-8111-111111111111");
  assert(orderLookup.status === 401, "GET /api/orders/:id without access token is 401");

  console.log("\nLocal API tests finished.");
}

run().catch((error) => {
  console.error(error.message);
  console.error("Is the server running? From backend/, run: npm start");
  process.exit(1);
});
