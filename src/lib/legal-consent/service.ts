import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  LEGAL_CONSENT_TYPES,
  type LegalConsentDTO,
  type LegalConsentType,
  type RecordLegalConsentInput,
} from "./types";

export type LegalConsentDependencies = {
  viewerClient: SupabaseClient;
  writerClient: SupabaseClient;
};

type ProviderError = { code?: string; message?: string; details?: string };

const CONSENT_VERSION_UNIQUE_CONSTRAINT = "user_legal_consents_user_id_consent_type_document_version_key";

function isConsentType(value: unknown): value is LegalConsentType {
  return LEGAL_CONSENT_TYPES.includes(value as LegalConsentType);
}

function validateInput(input: RecordLegalConsentInput) {
  if (
    !input
    || Object.keys(input).length !== 2
    || Object.keys(input).some((key) => key !== "consentType" && key !== "documentVersion")
    || !isConsentType(input.consentType)
    || typeof input.documentVersion !== "string"
    || !input.documentVersion.trim()
    || input.documentVersion.length > 200
  ) {
    throw new Error("invalid_input");
  }
  return {
    consentType: input.consentType,
    documentVersion: input.documentVersion.trim(),
  };
}

async function requireFreshUser(client: SupabaseClient): Promise<User> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("unauthenticated");
  return data.user;
}

export async function recordLegalConsent(
  input: RecordLegalConsentInput,
  dependencies?: LegalConsentDependencies,
) {
  const validated = validateInput(input);
  const viewerClient = dependencies?.viewerClient ?? await createSupabaseServerClient();
  const viewer = await requireFreshUser(viewerClient);
  const writerClient = dependencies?.writerClient ?? createSupabaseAdminClient();
  const { error } = await writerClient.from("user_legal_consents").insert({
    user_id: viewer.id,
    consent_type: validated.consentType,
    document_version: validated.documentVersion,
    consented_at: new Date().toISOString(),
  });

  if (error) {
    const providerError = error as ProviderError;
    const constraintText = `${providerError.message ?? ""} ${providerError.details ?? ""}`;
    const expectedDuplicate = providerError.code === "23505"
      && constraintText.includes(CONSENT_VERSION_UNIQUE_CONSTRAINT);
    if (!expectedDuplicate) throw new Error("temporary");
  }
}

export async function listLegalConsents(
  viewerClient?: SupabaseClient,
): Promise<LegalConsentDTO[]> {
  const client = viewerClient ?? await createSupabaseServerClient();
  const viewer = await requireFreshUser(client);
  const { data, error } = await client
    .from("user_legal_consents")
    .select("id, consent_type, document_version, consented_at")
    .eq("user_id", viewer.id)
    .order("consented_at", { ascending: false });
  if (error) throw new Error("temporary");

  return (data ?? []).map((row) => ({
    id: row.id,
    consentType: row.consent_type,
    documentVersion: row.document_version,
    consentedAt: row.consented_at,
  }));
}
