import type { ButtonHTMLAttributes } from "react";

export function PanelOpenIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/><path d="m15.5 12 3-3m0 0v2.5M18.5 9H16"/></svg>;
}

export function AdminPanelButton({ className = "", children, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type={type} className={`button admin-panel-button ${className}`.trim()}><PanelOpenIcon/><span>{children}</span></button>;
}
