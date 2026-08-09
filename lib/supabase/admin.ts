import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env.public";
import { serverEnv } from "@/lib/env.server";

export function createAdminClient() {
  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
