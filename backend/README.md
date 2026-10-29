# ZAINAB CLUB backend

This folder is the API for your existing HTML/CSS/JavaScript shop. It does **not** replace the frontend.

Stack: Node.js, Express, Supabase (PostgreSQL).

## 1. Install Node.js

You need Node.js 18 or newer. Check with:

```bash
node -v
```

## 2. Install backend packages

In a terminal:

```bash
cd "C:\Users\AMAAN AHMAD\OneDrive\Desktop\Zainab Club\backend"
npm install
```

## 3. Create a Supabase project

1. Open [https://supabase.com](https://supabase.com) and create a project.
2. Wait until the database is ready.
3. Go to **Project Settings → API**.
4. Copy:
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server only**)

Never put the service role key in HTML or `cart.js`.

## 4. Environment variables

```bash
copy .env.example .env
```

Then edit `backend/.env` with your real values.

Create a long admin key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste that into `ADMIN_API_KEY`.

## 5. Create the database

In the Supabase dashboard open **SQL Editor** and run these files **in order**:

1. `sql/001_schema.sql`
2. `sql/002_rls.sql`
3. `sql/003_seed.sql`

Optional, only for trying checkout with fake stock:

4. `sql/004_optional_test_stock.sql` (uncomment an `update` if you want)

**Stock is currently `NULL` (unconfirmed).** Until you set numbers, orders will still be accepted and stock will not be decremented. After you know real quantities:

```sql
update inventory
set quantity = 10
where variant_id = 'a2222222-0001-4000-8000-000000000001';
```

## 6. Run the API

```bash
cd "C:\Users\AMAAN AHMAD\OneDrive\Desktop\Zainab Club\backend"
npm start
```

Open:

- API health: [http://localhost:3000/api/health](http://localhost:3000/api/health)
- Website (same server): [http://localhost:3000/index.html](http://localhost:3000/index.html)

Auto-restart while you edit:

```bash
npm run dev
```

## 7. Frontend API URL

The browser talks to:

`http://localhost:3000/api`

That value lives in `js/api.js` (`API_BASE`). If you deploy later, change it to your live API URL.

## 8. Public endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/api/health` | Server is up |
| GET | `/api/products` | Catalogue |
| GET | `/api/products/:id` | One product + variants |
| POST | `/api/orders` | Create an unpaid order |
| GET | `/api/orders/:id?access_token=...` | Customer can view **their** order only |

The server **ignores** any price or total sent by the browser. It reads prices from PostgreSQL.

Orders are saved as `pending_payment` / `unpaid`. This is **not** a paid order.

## 9. Admin endpoints

Send header:

`Authorization: Bearer YOUR_ADMIN_API_KEY`

| Method | Path |
|---|---|
| GET | `/api/admin/products` |
| POST | `/api/admin/products` |
| PATCH | `/api/admin/products/:id` |
| POST | `/api/admin/variants` |
| PATCH | `/api/admin/inventory/:variantId` |
| GET | `/api/admin/orders` |
| GET | `/api/admin/orders/:id` |
| PATCH | `/api/admin/orders/:id/status` |

There is no default password. If `ADMIN_API_KEY` is missing, admin routes return 503.

## 10. Test locally

With the server running:

```bash
npm run test:api
```

Product and successful-order tests only pass after `.env` and SQL files are set up.

Example order (PowerShell):

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/orders -ContentType "application/json" -Body '{"customer":{"name":"Amaan","email":"you@example.com","phone":"9999999999","address_line1":"12 Example Street","city":"Lucknow","state":"Uttar Pradesh","postal_code":"226001"},"items":[{"variant_id":"a2222222-0001-4000-8000-000000000001","quantity":1,"price":1}]}'
```

The `price: 1` field is ignored. The stored total will still be ₹250 if that graphic tee variant exists.

## Seeded products (from your HTML)

| Product | Price | Variants |
|---|---|---|
| Everyday Essential Trackpant | ₹450 | S–XXL × Black, Brown, Olive Green |
| Graphic Print T-shirt | ₹250 | S, M × Black, Light Brown |
| Oversized Streetwear T-shirt | ₹250 | S, M × Red |
| Black-Bead Necklace & Earrings Set | ₹250 | one default variant |
| Green-Bead Necklace & Earrings Set | ₹250 | one default variant |

Please confirm oversized colour (HTML label is Red, `data-colour` was Black) and graphic “Light Brown” vs `data-colour="red"`.
