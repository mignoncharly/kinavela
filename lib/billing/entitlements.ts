import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  billingEntitlementsSchema,
  type BillingEntitlements,
} from "@/lib/validation/billing";

export async function getBillingEntitlements(): Promise<BillingEntitlements | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_entitlements");
  if (error) return null;
  const parsed = billingEntitlementsSchema.safeParse(
    Array.isArray(data) ? data[0] : data,
  );
  return parsed.success ? parsed.data : null;
}
