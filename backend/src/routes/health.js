import { Router } from "express";
import { sendOk } from "../http.js";

export const healthRouter = Router();

healthRouter.get("/health", function health(_req, res) {
  const supabaseConfigured = Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_URL.includes("YOUR_PROJECT_REF")
  );

  sendOk(res, {
    service: "zainab-club-api",
    status: "ok",
    supabaseConfigured
  });
});
