export type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
};

export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
  busy = false,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => {
        if (disabled) {
          return;
        }
        onChange(!checked);
      }}
      style={{
        position: "relative",
        width: 34,
        height: 18,
        borderRadius: "var(--radius-pill)",
        border: "none",
        padding: 0,
        flexShrink: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        background: checked ? "rgba(34,229,255,0.9)" : "rgba(255,255,255,0.12)",
        boxShadow: checked ? "0 0 10px rgba(34,229,255,0.45)" : undefined,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 14,
          height: 14,
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--color-bg)" : "var(--color-muted)",
        }}
      />
    </button>
  );
}
