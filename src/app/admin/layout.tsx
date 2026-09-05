import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-shell">
    <header className="admin-header">
      <Link className="brand" href="/admin">muuzee / admin</Link>
      <nav className="admin-nav" aria-label="Admin navigation">
        <Link href="/admin">Dashboard（概要）</Link>
        <Link href="/admin/imports">Imports（取込）</Link>
        <Link href="/admin/exhibitions">Exhibitions（展覧会）</Link>
        <Link href="/admin/venues">Venues（会場）</Link>
        <Link href="/admin/artists">Artists（作家）</Link>
        <Link href="/admin/works">Works（作品）</Link>
      </nav>
    </header>
    <main className="admin-main">{children}</main>
  </div>;
}
