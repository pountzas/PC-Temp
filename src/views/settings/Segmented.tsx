export type SegmentedOption<T extends string | number> = {
  value: T;
  label: string;
};

export type SegmentedProps<T extends string | number> = {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
};

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: "flex",
        padding: 2,
        borderRadius: "var(--radius-sm)",
        background: "rgba(255,255,255,0.06)",
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              onChange(option.value);
            }}
            style={{
              padding: "3px 9px",
              borderRadius: 3,
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              lineHeight: "14px",
              background: selected ? "rgba(34,229,255,0.16)" : "transparent",
              color: selected ? "var(--color-cpu)" : "var(--color-muted)",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
