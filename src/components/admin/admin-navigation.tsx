"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  href: string;
  label: string;
  icon: AdminIconName;
  exact?: boolean;
};

type AdminIconName = "dashboard" | "exhibition" | "venue" | "artist" | "work" | "users" | "import" | "source";

const primaryItems: NavigationItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/admin/exhibitions", label: "Exhibitions", icon: "exhibition" },
  { href: "/admin/venues", label: "Venue", icon: "venue" },
  { href: "/admin/artists", label: "Artist", icon: "artist" },
  { href: "/admin/works", label: "Works", icon: "work" },
];

const dataItems: NavigationItem[] = [
  { href: "/admin/imports", label: "取り込み実行", icon: "import" },
  { href: "/admin/sources", label: "外部Source設定", icon: "source" },
];

function AdminIcon({ name }: { name: AdminIconName }) {
  const paths: Record<AdminIconName, React.ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    exhibition: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    venue: <><path d="M3 9h18M5 9v10M9 9v10M15 9v10M19 9v10M3 19h18M4 8l8-5 8 5"/></>,
    artist: <><circle cx="12" cy="8" r="3"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></>,
    work: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m6 17 4-4 3 3 2-2 3 3"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    import: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
    source: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12v7c0 1.66 3.58 3 8 3s8-1.34 8-3v-7"/></>,
  };

  return <svg className="admin-nav-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function AdminNavigationLink({ href, label, icon, exact }: NavigationItem) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return <Link className={`admin-nav-link${active ? " is-active" : ""}`} href={href} prefetch={false} aria-current={active ? "page" : undefined}><span className="admin-nav-link-main"><AdminIcon name={icon}/><span>{label}</span></span></Link>;
}

export function AdminNavigation() {
  return <nav className="admin-nav" aria-label="Admin navigation">
    <div className="admin-nav-group">
      <p className="admin-nav-label">Workspace</p>
      {primaryItems.map((item) => <AdminNavigationLink key={item.href} {...item}/>)}
      <span className="admin-nav-link is-disabled" aria-disabled="true"><span className="admin-nav-link-main"><AdminIcon name="users"/><span>Users</span></span><small>準備中</small></span>
    </div>
    <div className="admin-nav-group">
      <p className="admin-nav-label">データ取り込み</p>
      {dataItems.map((item) => <AdminNavigationLink key={item.href} {...item}/>)}
    </div>
  </nav>;
}
