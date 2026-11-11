import Link from "next/link";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { requireAdminPageAccess } from "@/lib/admin/server-authorization";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPageAccess();
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link className="brand" href="/admin" prefetch={false}>Muuzee <span>Admin</span></Link>
      <AdminNavigation/>
      <p className="admin-sidebar-environment">STG / LOCAL</p>
    </aside>
    <div className="admin-content"><main className="admin-main">{children}</main></div>
  </div>;
}
