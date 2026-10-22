export function isAdminNavigationItemActive(pathname: string, item: { href: string; exact?: boolean; aliases?: string[] }) {
  const matches = (href: string, exact = false) => exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return matches(item.href, item.exact) || (item.aliases || []).some((href) => matches(href));
}
