
import { Router } from "express";
import { getSupabaseAdmin } from "../db.js";
import { asyncHandler, sendError, sendOk } from "../http.js";
import { isUuid, validateOrderPayload } from "../validation.js";

export const ordersRouter = Router();

const ORDER_ERROR_MAP = {
  CART_EMPTY: {
    status: 400,
    message: "Your cart is empty."
  },

  INVALID_CUSTOMER: {
    status: 400,
    message: "Customer or delivery details are incomplete."
  },

  INVALID_VARIANT: {
    status: 400,
    message: "One of the products is not a valid variant."
  },

  INVALID_QUANTITY: {
    status: 400,
    message: "Quantity must be between 1 and 20."
  },

  VARIANT_NOT_FOUND: {
    status: 400,
    message: "A selected product variant was not found."
  },

  VARIANT_UNAVAILABLE: {
    status: 409,
    message: "A selected product is no longer available."
  },

  INSUFFICIENT_STOCK: {
    status: 409,
    message: "Not enough stock for one of the selected items."
  },

  STOCK_UNCONFIRMED: {
    status: 409,
    message:
      "This product's stock has not been confirmed yet. Please try again later."
  },

  ORDER_TOTAL_TOO_LARGE: {
    status: 400,
    message:
      "The order total is too large to process. Please reduce your order."
  }
};

/**
 * Create an order.
 *
 * Prices and stock are validated by the database function,
 * not trusted from the browser.
 */
ordersRouter.post(
  "/orders",
  asyncHandler(async function createOrder(req, res) {
    const check = validateOrderPayload(req.body);

    if (!check.ok) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Please fix the highlighted fields.",
        check.errors
      );
    }

    const customer = req.body.customer;

    const items = req.body.items.map((item) => ({
      variant_id: item.variant_id,
      quantity: item.quantity
    }));

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc("place_order", {
      p_customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address_line1: customer.address_line1,
        address_line2: customer.address_line2 || "",
        city: customer.city,
        state: customer.state,
        postal_code: customer.postal_code,
        country: customer.country || "IN",
        notes: customer.notes || ""
      },
      p_items: items
    });

    if (error) {
      const mapped = ORDER_ERROR_MAP[error.message];

      if (mapped) {
        return sendError(
          res,
          mapped.status,
          error.message,
          mapped.message
        );
      }

      error.status = 500;
      error.code = "DB_ERROR";
      throw error;
    }

    return sendOk(
      res,
      {
        orderId: data.id,
        accessToken: data.access_token,
        subtotalRupees: data.subtotal_rupees,
        status: data.status,
        paymentStatus: data.payment_status,
        message:
          "Order saved. Payment has not been collected. This is not a paid order until a payment gateway confirms it."
      },
      201
    );
  })
);

/**
 * Retrieve an order using its order ID and access token.
 */
ordersRouter.get(
  "/orders/:id",
  asyncHandler(async function getOrder(req, res) {
    const orderId = req.params.id;
    const accessToken = req.get("x-order-token");

    if (!isUuid(orderId) || !accessToken) {
      return sendError(
        res,
        400,
        "INVALID_ORDER_LOOKUP",
        "A valid order ID and access token are required."
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        status,
        payment_status,
        subtotal_rupees,
        customer_name,
        customer_email,
        customer_phone,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
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
      .eq("id", orderId)
      .eq("access_token", accessToken)
      .maybeSingle();

    if (error) {
      error.status = 500;
      error.code = "DB_ERROR";
      throw error;
    }

    if (!data) {
      return sendError(
        res,
        404,
        "ORDER_NOT_FOUND",
        "Order not found. Please check the order details."
      );
    }

    return sendOk(res, {
      order: {
        id: data.id,
        status: data.status,
        paymentStatus: data.payment_status,
        subtotalRupees: data.subtotal_rupees,
        customer: {
          name: data.customer_name,
          email: data.customer_email,
          phone: data.customer_phone
        },
        delivery: {
          addressLine1: data.address_line1,
          addressLine2: data.address_line2,
          city: data.city,
          state: data.state,
          postalCode: data.postal_code,
          country: data.country
        },
        items: data.order_items,
        createdAt: data.created_at,
        paid: data.payment_status === "paid"
      }
    });
  })
);
