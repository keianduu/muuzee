import Link from "next/link";
import { AdminNavigation } from "@/components/admin/admin-navigation";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link className="brand" href="/admin" prefetch={false}>Muuzee <span>Admin</span></Link>
      <AdminNavigation/>
      <p className="admin-sidebar-environment">STG / LOCAL</p>
    </aside>
    <div className="admin-content"><main className="admin-main">{children}</main></div>
  </div>;
}
