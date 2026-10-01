"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  href: string;
  label: string;
  exact?: boolean;
};

const primaryItems: NavigationItem[] = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/exhibitions", label: "Exhibitions" },
  { href: "/admin/venues", label: "Venue" },
  { href: "/admin/artists", label: "Artist" },
  { href: "/admin/works", label: "Works" },
];

const dataItems: NavigationItem[] = [
  { href: "/admin/imports", label: "取り込み実行" },
  { href: "/admin/sources", label: "外部Source設定" },
];

function AdminNavigationLink({ href, label, exact }: NavigationItem) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return <Link className={`admin-nav-link${active ? " is-active" : ""}`} href={href} prefetch={false} aria-current={active ? "page" : undefined}>{label}</Link>;
}

export function AdminNavigation() {
  return <nav className="admin-nav" aria-label="Admin navigation">
    <div className="admin-nav-group">
      <p className="admin-nav-label">Workspace</p>
      {primaryItems.map((item) => <AdminNavigationLink key={item.href} {...item}/>)}
      <span className="admin-nav-link is-disabled" aria-disabled="true">Users <small>準備中</small></span>
    </div>
    <div className="admin-nav-group">
      <p className="admin-nav-label">データ取り込み</p>
      {dataItems.map((item) => <AdminNavigationLink key={item.href} {...item}/>)}
    </div>
  </nav>;
}
