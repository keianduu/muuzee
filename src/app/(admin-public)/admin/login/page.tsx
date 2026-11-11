import { AdminLoginForm } from "./admin-login-form";

export default function AdminLoginPage() {
  return <main className="admin-auth-page">
    <section className="admin-auth-card" aria-labelledby="admin-login-title">
      <p className="eyebrow">Muuzee Admin</p>
      <h1 id="admin-login-title">管理画面へログイン</h1>
      <p className="muted">管理権限のあるアカウントでログインしてください。</p>
      <AdminLoginForm/>
    </section>
  </main>;
}
