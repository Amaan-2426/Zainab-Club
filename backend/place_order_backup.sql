
-- BACKUP ONLY: Original ZAINAB CLUB place_order function.
-- Do not run this file in Supabase.

CREATE OR REPLACE FUNCTION place_order(p_customer jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
BEGIN
  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'CART_EMPTY' USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'variant_id', variant_id,
      'quantity', quantity
    )
  )
  INTO p_items
  FROM (
    SELECT
      value->>'variant_id' AS variant_id,
      SUM((value->>'quantity')::integer) AS quantity
    FROM jsonb_array_elements(p_items)
    GROUP BY value->>'variant_id'
  ) grouped;

  v_email := lower(trim(p_customer->>'email'));

  IF coalesce(trim(p_customer->>'name'), '') = ''
     OR coalesce(v_email, '') = ''
     OR v_email !~ '^[^@]+@[^@]+\.[^@]+$'
     OR coalesce(trim(p_customer->>'phone'), '') = ''
     OR coalesce(trim(p_customer->>'address_line1'), '') = ''
     OR coalesce(trim(p_customer->>'city'), '') = ''
     OR coalesce(trim(p_customer->>'state'), '') = ''
     OR coalesce(trim(p_customer->>'postal_code'), '') = '' THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_variant_id := (v_item->>'variant_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'INVALID_VARIANT' USING ERRCODE = 'P0001';
    END;

    v_qty := (v_item->>'quantity')::integer;

    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 20 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = 'P0001';
    END IF;

    SELECT
      pv.product_id,
      p.name,
      pv.size,
      pv.colour,
      p.price_rupees,
      (pv.is_active AND p.is_active),
      i.quantity
    INTO
      v_product_id,
      v_product_name,
      v_size,
      v_colour,
      v_price,
      v_active,
      v_stock
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    JOIN inventory i ON i.variant_id = pv.id
    WHERE pv.id = v_variant_id
    FOR UPDATE OF i;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'VARIANT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    IF v_active IS NOT TRUE THEN
      RAISE EXCEPTION 'VARIANT_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;

    IF v_stock IS NOT NULL AND v_stock < v_qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
    END IF;

    v_subtotal := v_subtotal + (v_price * v_qty);
  END LOOP;

  INSERT INTO orders (
    customer_name, customer_email, customer_phone,
    address_line1, address_line2, city, state,
    postal_code, country, notes, subtotal_rupees,
    status, payment_status
  )
  VALUES (
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
  RETURNING id, access_token INTO v_order_id, v_access;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    SELECT
      pv.product_id,
      p.name,
      pv.size,
      pv.colour,
      p.price_rupees,
      i.quantity
    INTO
      v_product_id,
      v_product_name,
      v_size,
      v_colour,
      v_price,
      v_stock
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    JOIN inventory i ON i.variant_id = pv.id
    WHERE pv.id = v_variant_id
    FOR UPDATE OF i;

    INSERT INTO order_items (
      order_id, product_id, variant_id, product_name,
      size, colour, quantity, unit_price_rupees,
      line_total_rupees
    )
    VALUES (
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

    IF v_stock IS NOT NULL THEN
      UPDATE inventory
      SET quantity = quantity - v_qty,
          updated_at = now()
      WHERE variant_id = v_variant_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'access_token', v_access,
    'subtotal_rupees', v_subtotal,
    'status', 'pending_payment',
    'payment_status', 'unpaid'
  );
END;
$$;
