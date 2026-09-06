import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-shell">
    <header className="admin-header">
      <Link className="brand" href="/admin" prefetch={false}>muuzee / admin</Link>
      <nav className="admin-nav" aria-label="Admin navigation">
        <Link href="/admin" prefetch={false}>Dashboard（概要）</Link>
        <Link href="/admin/imports" prefetch={false}>Imports（取込）</Link>
        <Link href="/admin/exhibitions" prefetch={false}>Exhibitions（展覧会）</Link>
        <Link href="/admin/venues" prefetch={false}>Venues（会場）</Link>
        <Link href="/admin/artists" prefetch={false}>Artists（作家）</Link>
        <Link href="/admin/works" prefetch={false}>Works（作品）</Link>
      </nav>
    </header>
    <main className="admin-main">{children}</main>
  </div>;
}
