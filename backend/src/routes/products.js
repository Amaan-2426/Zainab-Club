import { Router } from "express";
import { getSupabaseAdmin } from "../db.js";
import { asyncHandler, sendError, sendOk } from "../http.js";
import { isUuid } from "../validation.js";

export const productsRouter = Router();

function inventoryQuantity(inventory) {
  if (inventory == null) return null;
  if (Array.isArray(inventory)) {
    return inventory[0] ? inventory[0].quantity : null;
  }
  return inventory.quantity;
}

function shapeProduct(row) {
  const variants = (row.product_variants || []).map((variant) => {
    const stock = inventoryQuantity(variant.inventory);
    return {
      id: variant.id,
      size: variant.size,
      colour: variant.colour,
      sku: variant.sku,
      stockTracked: stock !== null && stock !== undefined,
      inStock: stock === null || stock === undefined ? true : stock > 0,
      quantityAvailable: stock === null || stock === undefined ? null : stock
    };
  });

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    priceRupees: row.price_rupees,
    detailPage: row.detail_page,
    mediaPath: row.media_path,
    variants
  };
}

const PRODUCT_SELECT = `
  id, slug, name, category, description, price_rupees, detail_page, media_path,
  product_variants (
    id, size, colour, sku, is_active,
    inventory ( quantity )
  )
`;

productsRouter.get(
  "/products",
  asyncHandler(async function listProducts(_req, res) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true)
      .order("name");

    if (error) {
      error.status = 500;
      error.code = "DB_ERROR";
      throw error;
    }

    const products = (data || [])
      .map((row) => {
        row.product_variants = (row.product_variants || []).filter((v) => v.is_active);
        return shapeProduct(row);
      });

    sendOk(res, { products });
  })
);

productsRouter.get(
  "/products/:id",
  asyncHandler(async function getProduct(req, res) {
    if (!isUuid(req.params.id)) {
      return sendError(res, 400, "INVALID_ID", "Product id must be a UUID.");
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("id", req.params.id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      error.status = 500;
      error.code = "DB_ERROR";
      throw error;
    }

    if (!data) {
      return sendError(res, 404, "NOT_FOUND", "Product not found.");
    }

    data.product_variants = (data.product_variants || []).filter((v) => v.is_active);
    sendOk(res, { product: shapeProduct(data) });
  })
);
