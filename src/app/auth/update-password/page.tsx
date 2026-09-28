import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  readPasswordRecoveryMarker,
  verifyPasswordRecoveryMarker,
} from "@/lib/auth/recovery";
import { AUTH_COMPLETE_PATH } from "@/lib/auth/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = {
  title: "パスワード再設定 | Muuzee",
};

export default async function UpdatePasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  if (
    error
    || !data.user
    || !verifyPasswordRecoveryMarker(readPasswordRecoveryMarker(cookieStore), data.user.id)
  ) {
    redirect(`${AUTH_COMPLETE_PATH}?authError=expired_or_invalid_link`);
  }

  return (
    <main className="admin-main">
      <div className="page-head">
        <div>
          <p className="eyebrow">Account</p>
          <h1>パスワード再設定</h1>
          <p className="muted">メールの再設定リンクから開いたセッションで、新しいパスワードを設定します。</p>
        </div>
      </div>
      <UpdatePasswordForm />
    </main>
  );
}
