import type { ButtonHTMLAttributes } from "react";

export function TrashIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>;
}

export function AdminDeleteButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title" | "children">) {
  const { className = "", type = "button", ...rest } = props;
  return <button {...rest} type={type} className={`admin-icon-button admin-icon-button--danger ${className}`.trim()} aria-label="削除" title="削除"><TrashIcon/></button>;
}
