export type AdminFeedbackVariant = "success" | "warning" | "error" | "info";

const ICONS: Record<AdminFeedbackVariant, string> = {
  success: "✓",
  warning: "!",
  error: "!",
  info: "i",
};

export function AdminFeedback({ message, variant = "info", className = "" }: {
  message?: string | null;
  variant?: AdminFeedbackVariant;
  className?: string;
}) {
  if (!message) return null;
  return <div className={`admin-feedback admin-feedback--${variant}${className ? ` ${className}` : ""}`} role={variant === "error" ? "alert" : "status"} aria-live={variant === "error" ? "assertive" : "polite"}>
    <span className="admin-feedback-icon" aria-hidden="true">{ICONS[variant]}</span>
    <span>{message}</span>
  </div>;
}
