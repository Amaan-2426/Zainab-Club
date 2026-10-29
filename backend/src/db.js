
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !url ||
    !serviceKey ||
    url.includes("YOUR_PROJECT_REF")
  ) {
    const error = new Error(
      "Supabase is not configured. Check backend/.env."
    );

    error.status = 503;
    error.code = "SUPABASE_NOT_CONFIGURED";

    throw error;
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    realtime: {
      transport: ws
    }
  });
}
