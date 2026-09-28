import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = {
  title: "パスワード再設定 | Muuzee",
};

export default async function UpdatePasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/?authError=unauthenticated");

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
