import { AdminLogoutButton } from "./logout-button";

export default function AdminAccessDeniedPage() {
  return <main className="admin-auth-page">
    <section className="admin-auth-card" aria-labelledby="admin-access-denied-title">
      <p className="eyebrow">Muuzee Admin</p>
      <h1 id="admin-access-denied-title">管理画面を利用できません</h1>
      <p className="muted">このアカウントには管理画面を利用する権限がありません。</p>
      <div className="admin-auth-actions"><AdminLogoutButton/></div>
    </section>
  </main>;
}
