import type { ArtWallItemDTO, ArtWallSettingsDTO, PersonalActionDTO, PreferencesDTO, ProfileDTO } from "@/lib/user/types";
import type { LegalConsentDTO } from "@/lib/legal-consent/types";

export type AccountLifecycleErrorCode =
  | "unauthenticated"
  | "reauthentication_required"
  | "invalid_credentials"
  | "invalid_input"
  | "storage_cleanup_required"
  | "temporary";

export type AccountLifecycleResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AccountLifecycleErrorCode; retryable: boolean } };

export type AccountExportDTO = {
  exportedAt: string;
  account: {
    id: string;
    email: string | null;
    createdAt: string;
    emailConfirmedAt: string | null;
  };
  profile: ProfileDTO | null;
  avatarAsset: { status: "not_present" } | { status: "unavailable"; reason: "storage_export_not_implemented" };
  preferences: PreferencesDTO | null;
  saved: PersonalActionDTO[];
  seen: PersonalActionDTO[];
  favorite: PersonalActionDTO[];
  artWall: {
    settings: ArtWallSettingsDTO | null;
    items: ArtWallItemDTO[];
  };
  legalConsents: LegalConsentDTO[];
};

export type AccountDeletionAggregate = {
  deletedOn: string;
  signupMonth: string;
  tenureBucket: "0-30" | "31-90" | "91-180" | "181-365" | "366+";
};
