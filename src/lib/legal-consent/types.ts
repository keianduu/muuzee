export const LEGAL_CONSENT_TYPES = ["terms", "privacy"] as const;

export type LegalConsentType = (typeof LEGAL_CONSENT_TYPES)[number];

export type LegalConsentDTO = {
  id: string;
  consentType: LegalConsentType;
  documentVersion: string;
  consentedAt: string;
};

export type RecordLegalConsentInput = {
  consentType: LegalConsentType;
  documentVersion: string;
};
