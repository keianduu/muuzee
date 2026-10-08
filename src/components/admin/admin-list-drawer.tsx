"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

export type AdminListDrawerKind = "search" | "csv" | "new";

const LIST_DRAWER_OPEN_EVENT = "muuzee:list-drawer-open";

export function announceAdminListDrawer(kind: AdminListDrawerKind) {
  window.dispatchEvent(new CustomEvent(LIST_DRAWER_OPEN_EVENT, { detail: { kind } }));
}

export function AdminListDrawer({ kind, open, eyebrow, title, labelledBy, initialFocusRef, onClose, children, footer, bodyClassName = "" }: {
  kind: AdminListDrawerKind;
  open: boolean;
  eyebrow: string;
  title: string;
  labelledBy: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: (restoreFocus?: boolean) => void;
  children: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const closeForAnotherDrawer = (event: Event) => {
      const requested = (event as CustomEvent<{ kind?: AdminListDrawerKind }>).detail?.kind;
      if (open && requested && requested !== kind) onClose(false);
    };
    window.addEventListener(LIST_DRAWER_OPEN_EVENT, closeForAnotherDrawer);
    return () => window.removeEventListener(LIST_DRAWER_OPEN_EVENT, closeForAnotherDrawer);
  }, [kind, onClose, open]);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("is-list-utility-drawer-open");
    window.requestAnimationFrame(() => (initialFocusRef?.current || closeRef.current)?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => {
        if (!document.querySelector(".admin-list-utility-layer")) document.body.classList.remove("is-list-utility-drawer-open");
      });
    };
  }, [initialFocusRef, onClose, open]);

  if (!open) return null;
  return <div className="admin-list-utility-layer" data-list-drawer={kind}>
    <button className="admin-list-utility-backdrop" type="button" aria-label={`${title}を閉じる`} onClick={() => onClose()}/>
    <aside ref={drawerRef} id={labelledBy} className="admin-list-utility-drawer" role="dialog" aria-modal="true" aria-labelledby={`${labelledBy}-title`}>
      <header className="admin-list-utility-head">
        <div><p className="eyebrow">{eyebrow}</p><h2 id={`${labelledBy}-title`}>{title}</h2></div>
        <button ref={closeRef} className="drawer-close" type="button" aria-label="閉じる" onClick={() => onClose()}>×</button>
      </header>
      <div className={`admin-list-utility-body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
      {footer && <footer className="admin-list-utility-footer">{footer}</footer>}
    </aside>
  </div>;
}

export function restoreListDrawerFocus(triggerRef: RefObject<HTMLElement | null>) {
  window.requestAnimationFrame(() => triggerRef.current?.focus());
}
