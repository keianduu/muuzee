import type { ReactNode } from "react";

type Props = {
  label: ReactNode;
  fieldKey: string;
  htmlFor?: string;
  as?: "label" | "span";
};

export function AdminFieldLabel({ label, fieldKey, htmlFor, as = htmlFor ? "label" : "span" }: Props) {
  const content = <><span className="admin-field-label-main">{label}</span><small className="admin-field-label-key">{fieldKey}</small></>;
  return as === "label"
    ? <label className="admin-field-label" htmlFor={htmlFor}>{content}</label>
    : <span className="admin-field-label">{content}</span>;
}
