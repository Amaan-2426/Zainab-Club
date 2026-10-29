
-- ZAINAB CLUB: Inventory Safety Migration
-- Preserves existing orders and current inventory quantities.
-- NULL inventory means stock is unconfirmed and cannot be purchased.

BEGIN;

-- 1. Ensure inventory quantities cannot be negative.
ALTER TABLE public.inventory
    DROP CONSTRAINT IF EXISTS inventory_quantity_nonnegative;

ALTER TABLE public.inventory
    ADD CONSTRAINT inventory_quantity_nonnegative
    CHECK (quantity IS NULL OR quantity >= 0) NOT VALID;

ALTER TABLE public.inventory
    VALIDATE CONSTRAINT inventory_quantity_nonnegative;

-- 2. Safely recreate the order-placement function.
CREATE OR REPLACE FUNCTION public.place_order(
    p_customer jsonb,
    p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid;
    v_access uuid;
    v_subtotal bigint := 0;
    v_line_total bigint;
    v_item jsonb;
    v_variant_id uuid;
    v_qty bigint;
    v_product_id uuid;
    v_product_name text;
    v_size text;
    v_colour text;
    v_price integer;
    v_active boolean;
    v_stock integer;
    v_email text;
    v_raw_qty numeric;
BEGIN
    -- Validate cart structure.
    IF p_items IS NULL
       OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'CART_EMPTY' USING ERRCODE = 'P0001';
    END IF;

    IF jsonb_typeof(p_customer) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'INVALID_CUSTOMER' USING ERRCODE = 'P0001';
    END IF;

    -- Validate customer details.
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

    -- Validate every raw cart line before aggregation.
    FOR v_item IN
        SELECT e.value
        FROM jsonb_array_elements(p_items) AS e(value)
    LOOP
        IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
           OR coalesce(v_item->>'variant_id', '') = ''
           OR coalesce(v_item->>'quantity', '') !~ '^[0-9]+$' THEN
            RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = 'P0001';
        END IF;

        v_raw_qty := (v_item->>'quantity')::numeric;

        IF v_raw_qty < 1 OR v_raw_qty > 20 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = 'P0001';
        END IF;
    END LOOP;

    -- Limit the number of distinct variants in a single order.
    IF (
        SELECT count(DISTINCT e.value->>'variant_id')
        FROM jsonb_array_elements(p_items) AS e(value)
    ) > 50 THEN
        RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = 'P0001';
    END IF;

    -- First pass: aggregate duplicate variants, lock inventory,
    -- validate availability, and calculate server-side prices.
    FOR v_item IN
        SELECT jsonb_build_object(
            'variant_id', e.value->>'variant_id',
            'quantity', SUM((e.value->>'quantity')::bigint)
        )
        FROM jsonb_array_elements(p_items) AS e(value)
        GROUP BY e.value->>'variant_id'
        ORDER BY e.value->>'variant_id'
    LOOP
        v_qty := (v_item->>'quantity')::bigint;

        IF v_qty < 1 OR v_qty > 20 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = 'P0001';
        END IF;

        BEGIN
            v_variant_id := (v_item->>'variant_id')::uuid;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'INVALID_VARIANT' USING ERRCODE = 'P0001';
        END;

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
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
        JOIN public.inventory i ON i.variant_id = pv.id
        WHERE pv.id = v_variant_id
        FOR UPDATE OF i;

        IF NOT FOUND THEN
            IF EXISTS (
                SELECT 1
                FROM public.product_variants pv
                WHERE pv.id = v_variant_id
            ) THEN
                RAISE EXCEPTION 'INVENTORY_RECORD_MISSING'
                    USING ERRCODE = 'P0001';
            END IF;

            RAISE EXCEPTION 'VARIANT_NOT_FOUND' USING ERRCODE = 'P0001';
        END IF;

        IF v_active IS NOT TRUE THEN
            RAISE EXCEPTION 'VARIANT_UNAVAILABLE' USING ERRCODE = 'P0001';
        END IF;

        IF v_price IS NULL OR v_price <= 0 THEN
            RAISE EXCEPTION 'INVALID_PRODUCT_PRICE' USING ERRCODE = 'P0001';
        END IF;

        IF v_stock IS NULL THEN
            RAISE EXCEPTION 'STOCK_UNCONFIRMED' USING ERRCODE = 'P0001';
        END IF;

        IF v_stock < v_qty THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
        END IF;

        v_line_total := v_price::bigint * v_qty;

        IF v_line_total > 2147483647 THEN
            RAISE EXCEPTION 'ORDER_TOTAL_TOO_LARGE'
                USING ERRCODE = 'P0001';
        END IF;

        v_subtotal := v_subtotal + v_line_total;

        IF v_subtotal > 2147483647 THEN
            RAISE EXCEPTION 'ORDER_TOTAL_TOO_LARGE'
                USING ERRCODE = 'P0001';
        END IF;
    END LOOP;

    -- Create the order only after all variants pass validation.
    INSERT INTO public.orders (
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
        v_subtotal::integer,
        'pending_payment',
        'unpaid'
    )
    RETURNING id, access_token INTO v_order_id, v_access;

    -- Second pass: create item snapshots and deduct confirmed stock.
    FOR v_item IN
        SELECT jsonb_build_object(
            'variant_id', e.value->>'variant_id',
            'quantity', SUM((e.value->>'quantity')::bigint)
        )
        FROM jsonb_array_elements(p_items) AS e(value)
        GROUP BY e.value->>'variant_id'
        ORDER BY e.value->>'variant_id'
    LOOP
        v_variant_id := (v_item->>'variant_id')::uuid;
        v_qty := (v_item->>'quantity')::bigint;

        SELECT
            pv.product_id,
            p.name,
            pv.size,
            pv.colour,
            p.price_rupees
        INTO
            v_product_id,
            v_product_name,
            v_size,
            v_colour,
            v_price
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
        WHERE pv.id = v_variant_id;

        v_line_total := v_price::bigint * v_qty;

        INSERT INTO public.order_items (
            order_id,
            product_id,
            variant_id,
            product_name,
            size,
            colour,
            quantity,
            unit_price_rupees,
            line_total_rupees
        )
        VALUES (
            v_order_id,
            v_product_id,
            v_variant_id,
            v_product_name,
            v_size,
            v_colour,
            v_qty::integer,
            v_price,
            v_line_total::integer
        );

        UPDATE public.inventory
        SET quantity = quantity - v_qty::integer,
            updated_at = now()
        WHERE variant_id = v_variant_id
          AND quantity IS NOT NULL
          AND quantity >= v_qty;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
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

-- Keep execution restricted to privileged backend access.
REVOKE ALL ON FUNCTION public.place_order(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.place_order(jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.place_order(jsonb, jsonb) FROM authenticated;

COMMIT;
