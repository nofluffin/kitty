import "server-only";

import type { Database } from "@kitty/db";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase with the service role key. Server only (spec section 7): the
 * browser never talks to Supabase. Returns null when the server isn't set up,
 * so pages can show "no connection" instead of crashing.
 */
let client: SupabaseClient<Database> | null | undefined;

export function db(): SupabaseClient<Database> | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}
