-- OPTIONAL. Not real warehouse stock.
-- Run this only if you want to try placing test orders that decrement inventory.
-- Replace 5 with your real counts when you know them.

-- Example: give every variant 5 units for local testing
-- update inventory set quantity = 5, updated_at = now();

-- Example: mark one size as sold out
-- update inventory
-- set quantity = 0, updated_at = now()
-- where variant_id = 'a2222222-0001-4000-8000-000000000001';
