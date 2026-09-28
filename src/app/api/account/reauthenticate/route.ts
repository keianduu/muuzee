import { type NextRequest } from "next/server";
import { lifecycleJsonResponse, readLifecycleJson } from "@/lib/account-lifecycle/http";
import { setAccountLifecycleMarker } from "@/lib/account-lifecycle/marker";
import { reauthenticateAccount } from "@/lib/account-lifecycle/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const input = await readLifecycleJson(request);
  const { supabase, applyAuthState } = createSupabaseRouteClient(request);
  const result = await reauthenticateAccount(supabase, input);
  const response = applyAuthState(lifecycleJsonResponse(result));
  if (result.ok) setAccountLifecycleMarker(response);
  return response;
}
