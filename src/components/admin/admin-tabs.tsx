"use client";

export type AdminTab<T extends string> = { id: T; label: string };

export function AdminTabs<T extends string>({ tabs, value, onChange, label, variant = "detail", returnAnchor }: {
  tabs: readonly AdminTab<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  variant?: "detail" | "edit";
  returnAnchor?: T;
}) {
  return <div className={variant === "detail" ? "detail-tabs" : "admin-edit-tabs"} role="tablist" aria-label={label}>
    {tabs.map((tab) => <button
      type="button"
      role="tab"
      aria-selected={value === tab.id}
      className={value === tab.id ? "is-active" : ""}
      data-secondary-return-anchor={returnAnchor === tab.id ? String(tab.id) : undefined}
      key={tab.id}
      onClick={() => onChange(tab.id)}
    >{tab.label}</button>)}
  </div>;
}
