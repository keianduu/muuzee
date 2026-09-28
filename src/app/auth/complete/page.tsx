import type { Metadata } from "next";
import type { AuthErrorCode } from "@/lib/auth/types";

export const metadata: Metadata = {
  title: "認証完了 | Muuzee",
};

const ERROR_MESSAGES: Partial<Record<AuthErrorCode, string>> = {
  invalid_input: "認証情報を確認できませんでした。もう一度お手続きください。",
  invalid_credentials: "認証情報を確認できませんでした。もう一度お手続きください。",
  expired_or_invalid_link: "認証リンクが無効か、有効期限が切れています。もう一度お手続きください。",
  rate_limited: "しばらく待ってから、もう一度お試しください。",
  unauthenticated: "認証状態を確認できませんでした。もう一度お手続きください。",
  temporary: "現在、認証を完了できません。時間をおいて、もう一度お試しください。",
};

function safeAuthError(value: string | string[] | undefined) {
  const code = Array.isArray(value) ? value[0] : value;
  return code && Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code)
    ? code as AuthErrorCode
    : null;
}

export default async function AuthCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorCode = safeAuthError(params.authError);

  return (
    <main className="admin-main">
      <section className="card">
        <p className="eyebrow">Account</p>
        <h1>{errorCode ? "認証を完了できませんでした" : "認証が完了しました"}</h1>
        <p className={errorCode ? "error" : "muted"} role={errorCode ? "alert" : undefined}>
          {errorCode
            ? ERROR_MESSAGES[errorCode]
            : "Muuzeeのアカウント認証が完了しました。"}
        </p>
      </section>
    </main>
  );
}
