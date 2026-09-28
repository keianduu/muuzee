import { type NextRequest } from "next/server";
import { lifecycleJsonResponse, readLifecycleJson } from "@/lib/account-lifecycle/http";
import {
  clearAccountLifecycleMarker,
  readAccountLifecycleMarker,
} from "@/lib/account-lifecycle/marker";
import { deleteAccount } from "@/lib/account-lifecycle/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const input = await readLifecycleJson(request);
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  const result = await deleteAccount(
    supabase,
    input,
    readAccountLifecycleMarker(request.cookies),
  );
  const response = applyAuthState(lifecycleJsonResponse(result));
  if (
    result.ok
    || result.error.code === "reauthentication_required"
    || result.error.code === "unauthenticated"
  ) {
    clearAccountLifecycleMarker(response);
  }
  return response;
}
