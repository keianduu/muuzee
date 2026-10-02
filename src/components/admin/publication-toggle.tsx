type Props = {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  describedBy?: string;
  onChange: (next: boolean) => void;
};

export function PublicationToggle({ checked, disabled = false, busy = false, describedBy, onChange }: Props) {
  return <div className="publication-toggle-wrap">
    <button
      type="button"
      className="publication-toggle"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? "公開を停止" : "公開する"}
      aria-describedby={describedBy}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
    ><span className="publication-toggle-knob"/></button>
    <span className="publication-toggle-label">{checked ? "公開中" : "非公開"}</span>
  </div>;
}
