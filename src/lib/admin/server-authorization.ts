import "server-only";

import { redirect } from "next/navigation";
import { authorizeAdminClaims } from "./authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAdminPageAccess() {
  let claims: unknown = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    if (!error) claims = data?.claims;
  } catch {
    claims = null;
  }

  const access = authorizeAdminClaims(claims);
  if (access.status === "allowed") return access;
  redirect(access.status === "unauthenticated" ? "/admin/login" : "/admin/access-denied");
}
