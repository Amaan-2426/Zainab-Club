
import { Router } from "express";
import { getSupabaseAdmin } from "../db.js";
import { asyncHandler, sendError, sendOk } from "../http.js";
import { requireAdmin } from "../middleware/adminAuth.js";

export const adminRouter = Router();

// All admin routes require a valid admin session.
adminRouter.use(requireAdmin);

function isValidUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value
    );
}

// GET /api/admin/orders
// Fetch all orders for the admin dashboard.
adminRouter.get(
    "/orders",
    asyncHandler(async function getOrders(_req, res) {
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from("orders")
            .select(`
                id,
                customer_name,
                customer_email,
                customer_phone,
                status,
                payment_status,
                subtotal_rupees,
                created_at
            `)
            .order("created_at", { ascending: false });

        if (error) {
            error.status = 500;
            error.code = "DB_ERROR";
            throw error;
        }

        const orders = (data || []).map((order) => ({
            id: order.id,
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            customer_phone: order.customer_phone,
            status: order.status,
            payment_status: order.payment_status,
            total_amount: order.subtotal_rupees,
            created_at: order.created_at
        }));

        return sendOk(res, { orders });
    })
);

// GET /api/admin/orders/:id
// Fetch complete details for one order.
adminRouter.get(
    "/orders/:id",
    asyncHandler(async function getOrderDetails(req, res) {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "INVALID_ID", "Invalid order ID.");
        }

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from("orders")
            .select(`
                id,
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
                status,
                payment_status,
                subtotal_rupees,
                created_at,
                order_items (
                    product_name,
                    size,
                    colour,
                    quantity,
                    unit_price_rupees,
                    line_total_rupees
                )
            `)
            .eq("id", id)
            .maybeSingle();

        if (error) {
            error.status = 500;
            error.code = "DB_ERROR";
            throw error;
        }

        if (!data) {
            return sendError(res, 404, "NOT_FOUND", "Order not found.");
        }

        return sendOk(res, {
            order: {
                id: data.id,
                customer_name: data.customer_name,
                customer_email: data.customer_email,
                customer_phone: data.customer_phone,
                address: {
                    line1: data.address_line1,
                    line2: data.address_line2,
                    city: data.city,
                    state: data.state,
                    postal_code: data.postal_code,
                    country: data.country
                },
                notes: data.notes,
                status: data.status,
                payment_status: data.payment_status,
                total_amount: data.subtotal_rupees,
                created_at: data.created_at,
                items: data.order_items || []
            }
        });
    })
);

// PATCH /api/admin/orders/:id/status
// Update an order's status with payment checks.
adminRouter.patch(
    "/orders/:id/status",
    asyncHandler(async function updateOrderStatus(req, res) {
        const { id } = req.params;
        const { status } = req.body || {};

        const allowedStatuses = [
            "pending_payment",
            "confirmed",
            "processing",
            "fulfilled",
            "cancelled"
        ];

        if (!isValidUuid(id)) {
            return sendError(res, 400, "INVALID_ID", "Invalid order ID.");
        }

        if (!allowedStatuses.includes(status)) {
            return sendError(res, 400, "INVALID_STATUS", "Invalid order status.");
        }

        const supabase = getSupabaseAdmin();

        const { data: order, error: readError } = await supabase
            .from("orders")
            .select("id, status, payment_status")
            .eq("id", id)
            .maybeSingle();

        if (readError) {
            readError.status = 500;
            readError.code = "DB_ERROR";
            throw readError;
        }

        if (!order) {
            return sendError(res, 404, "NOT_FOUND", "Order not found.");
        }

        if (
            ["confirmed", "processing", "fulfilled"].includes(status) &&
            order.payment_status !== "paid"
        ) {
            return sendError(
                res,
                409,
                "PAYMENT_REQUIRED",
                "An order cannot be confirmed or fulfilled until payment is verified."
            );
        }

        if (order.status === "cancelled" && status !== "cancelled") {
            return sendError(
                res,
                409,
                "ORDER_CANCELLED",
                "A cancelled order cannot be reopened here."
            );
        }

        const { data: updatedOrder, error: updateError } = await supabase
            .from("orders")
            .update({ status })
            .eq("id", id)
            .select("id, status, payment_status")
            .single();

        if (updateError) {
            updateError.status = 500;
            updateError.code = "DB_ERROR";
            throw updateError;
        }

        return sendOk(res, {
            order: updatedOrder,
            message: "Order status updated."
        });
    })
);

/* =========================================
   PRODUCT MANAGEMENT
   All routes are protected by requireAdmin.
   ========================================= */

/* =========================================
   INVENTORY MANAGEMENT
   PATCH /api/admin/inventory/:variantId
   ========================================= */

adminRouter.patch(
    "/inventory/:variantId",
    asyncHandler(async function updateInventory(req, res) {
        const { variantId } = req.params;
        const { quantity } = req.body || {};

        if (!isValidUuid(variantId)) {
            return sendError(
                res, 400, "INVALID_ID", "Invalid variant ID."
            );
        }

        if (!Number.isSafeInteger(quantity) || quantity < 0) {
            return sendError(
                res,
                400,
                "INVALID_QUANTITY",
                "Stock must be a non-negative whole number."
            );
        }

        const supabase = getSupabaseAdmin();

        // Confirm that this variant exists.
        const { data: variant, error: variantError } = await supabase
            .from("product_variants")
            .select("id")
            .eq("id", variantId)
            .maybeSingle();

        if (variantError) {
            variantError.status = 500;
            variantError.code = "DB_ERROR";
            throw variantError;
        }

        if (!variant) {
            return sendError(
                res, 404, "NOT_FOUND", "Product variant not found."
            );
        }

        // Update the existing inventory record only.
        // Do not create duplicate inventory rows.
        const { data: inventory, error: inventoryError } = await supabase
            .from("inventory")
            .update({ quantity })
            .eq("variant_id", variantId)
            .select("variant_id, quantity")
            .maybeSingle();

        if (inventoryError) {
            inventoryError.status = 500;
            inventoryError.code = "DB_ERROR";
            throw inventoryError;
        }

        if (!inventory) {
            return sendError(
                res,
                404,
                "INVENTORY_NOT_FOUND",
                "No inventory record exists for this variant."
            );
        }

        return sendOk(res, {
            inventory,
            message: "Stock quantity saved successfully."
        });
    })
);

// GET /api/admin/products
// Fetch active and inactive products for the admin.
adminRouter.get(
    "/products",
    asyncHandler(async function getAdminProducts(_req, res) {
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from("products")
            .select(`
                id,
                slug,
                name,
                category,
                description,
                price_rupees,
                detail_page,
                media_path,
                is_active,
                product_variants (
                    id,
                    size,
                    colour,
                    sku,
                    is_active,
                    inventory ( quantity )
                )
            `)
            .order("created_at", { ascending: false });

        if (error) {
            error.status = 500;
            error.code = "DB_ERROR";
            throw error;
        }

        return sendOk(res, { products: data || [] });
    })
);

// POST /api/admin/products
// Create a product and its variants.
adminRouter.post(
    "/products",
    asyncHandler(async function createProduct(req, res) {
        const {
            slug,
            name,
            category,
            description = "",
            priceRupees,
            detailPage = null,
            mediaPath = null,
            variants = []
        } = req.body || {};

        const allowedCategories = [
            "mens_clothing",
            "womens_jewellery"
        ];

        if (
            typeof slug !== "string" ||
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
            typeof name !== "string" ||
            !name.trim() ||
            !allowedCategories.includes(category) ||
            !Number.isSafeInteger(priceRupees) ||
            priceRupees <= 0 ||
            !Array.isArray(variants) ||
            variants.length === 0
        ) {
            return sendError(
                res,
                400,
                "INVALID_PRODUCT",
                "Provide a valid slug, name, category, positive whole-number price, and at least one variant."
            );
        }

        for (const variant of variants) {
            if (
                (variant.size != null && typeof variant.size !== "string") ||
                (variant.colour != null && typeof variant.colour !== "string") ||
                (variant.sku != null && typeof variant.sku !== "string") ||
                !Number.isSafeInteger(variant.quantity) ||
                variant.quantity < 0
            ) {
                return sendError(
                    res,
                    400,
                    "INVALID_VARIANT",
                    "Each variant needs valid size/colour/SKU values and a non-negative whole-number quantity."
                );
            }
        }

        const supabase = getSupabaseAdmin();

        const { data: product, error: productError } = await supabase
            .from("products")
            .insert({
                slug,
                name: name.trim(),
                category,
                description,
                price_rupees: priceRupees,
                detail_page: detailPage,
                media_path: mediaPath,
                is_active: true
            })
            .select("*")
            .single();

        if (productError) {
            if (productError.code === "23505") {
                return sendError(
                    res,
                    409,
                    "DUPLICATE_SLUG",
                    "A product with this slug already exists."
                );
            }

            productError.status = 500;
            productError.code = "DB_ERROR";
            throw productError;
        }

        const variantRows = variants.map((variant) => ({
            product_id: product.id,
            size: variant.size || null,
            colour: variant.colour || null,
            sku: variant.sku || null,
            is_active: true
        }));

        const { data: createdVariants, error: variantError } = await supabase
            .from("product_variants")
            .insert(variantRows)
            .select("id, size, colour, sku");

        if (variantError) {
            // Avoid leaving a product behind if its variants fail.
            await supabase
                .from("products")
                .delete()
                .eq("id", product.id);

            variantError.status = 500;
            variantError.code = "DB_ERROR";
            throw variantError;
        }

        const inventoryRows = createdVariants.map((variant, index) => ({
            variant_id: variant.id,
            quantity: variants[index].quantity
        }));

        const { error: inventoryError } = await supabase
            .from("inventory")
            .insert(inventoryRows);

        if (inventoryError) {
            // Clean up the incomplete new product.
            await supabase
                .from("products")
                .delete()
                .eq("id", product.id);

            inventoryError.status = 500;
            inventoryError.code = "DB_ERROR";
            throw inventoryError;
        }

        return sendOk(res, {
            product: {
                ...product,
                product_variants: createdVariants.map((variant, index) => ({
                    ...variant,
                    is_active: true,
                    inventory: { quantity: variants[index].quantity }
                }))
            },
            message: "Product created successfully."
        });
    })
);

// PATCH /api/admin/products/:id
// Update product details.
adminRouter.patch(
    "/products/:id",
    asyncHandler(async function updateProduct(req, res) {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "INVALID_ID", "Invalid product ID.");
        }

        const {
            slug,
            name,
            category,
            description,
            priceRupees,
            detailPage,
            mediaPath
        } = req.body || {};

        const allowedCategories = [
            "mens_clothing",
            "womens_jewellery"
        ];

        const updates = {};

        if (slug !== undefined) {
            if (
                typeof slug !== "string" ||
                !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
            ) {
                return sendError(res, 400, "INVALID_SLUG", "Invalid product slug.");
            }
            updates.slug = slug;
        }

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return sendError(res, 400, "INVALID_NAME", "Product name is required.");
            }
            updates.name = name.trim();
        }

        if (category !== undefined) {
            if (!allowedCategories.includes(category)) {
                return sendError(res, 400, "INVALID_CATEGORY", "Invalid product category.");
            }
            updates.category = category;
        }

        if (priceRupees !== undefined) {
            if (!Number.isSafeInteger(priceRupees) || priceRupees <= 0) {
                return sendError(res, 400, "INVALID_PRICE", "Price must be a positive whole number.");
            }
            updates.price_rupees = priceRupees;
        }

        if (description !== undefined) {
            if (typeof description !== "string") {
                return sendError(res, 400, "INVALID_DESCRIPTION", "Description must be text.");
            }
            updates.description = description;
        }

        if (detailPage !== undefined) updates.detail_page = detailPage;
        if (mediaPath !== undefined) updates.media_path = mediaPath;

        if (Object.keys(updates).length === 0) {
            return sendError(res, 400, "NO_CHANGES", "No product fields were provided.");
        }

        updates.updated_at = new Date().toISOString();

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from("products")
            .update(updates)
            .eq("id", id)
            .select("*")
            .maybeSingle();

        if (error) {
            if (error.code === "23505") {
                return sendError(res, 409, "DUPLICATE_SLUG", "That product slug is already in use.");
            }
            error.status = 500;
            error.code = "DB_ERROR";
            throw error;
        }

        if (!data) {
            return sendError(res, 404, "NOT_FOUND", "Product not found.");
        }

        return sendOk(res, {
            product: data,
            message: "Product updated successfully."
        });
    })
);

// PATCH /api/admin/products/:id/status
// Activate or deactivate without deleting order history.
adminRouter.patch(
    "/products/:id/status",
    asyncHandler(async function updateProductStatus(req, res) {
        const { id } = req.params;
        const { isActive } = req.body || {};

        if (!isValidUuid(id)) {
            return sendError(res, 400, "INVALID_ID", "Invalid product ID.");
        }

        if (typeof isActive !== "boolean") {
            return sendError(res, 400, "INVALID_STATUS", "isActive must be true or false.");
        }

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from("products")
            .update({
                is_active: isActive,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .select("id, name, is_active")
            .maybeSingle();

        if (error) {
            error.status = 500;
            error.code = "DB_ERROR";
            throw error;
        }

        if (!data) {
            return sendError(res, 404, "NOT_FOUND", "Product not found.");
        }

        return sendOk(res, {
            product: data,
            message: isActive ? "Product activated." : "Product deactivated."
        });
    })
);
