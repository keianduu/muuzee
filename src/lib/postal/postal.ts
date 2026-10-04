export type PostalAddress = {
  postalCode: string;
  prefecture: string;
  city: string;
  town: string;
  addressPrefix: string;
};

export interface PostalProvider {
  lookup(postalCode: string): Promise<PostalAddress>;
}

export class PostalValidationError extends Error {}
export class PostalProviderUnavailableError extends Error {}
export class PostalAddressNotFoundError extends Error {}

export function normalizeJapanPostalCode(input: string) {
  const normalized = input.normalize("NFKC").replace(/[\s-]/g, "");
  if (!/^\d{7}$/.test(normalized)) {
    throw new PostalValidationError("郵便番号は7桁の数字で入力してください。");
  }
  return normalized;
}

export function formatJapanPostalCode(input: string) {
  const normalized = normalizeJapanPostalCode(input);
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}

export async function lookupPostalAddress(input: string, provider: PostalProvider) {
  return provider.lookup(normalizeJapanPostalCode(input));
}
