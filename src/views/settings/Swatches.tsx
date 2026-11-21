import type { AccentColor } from "../../ipc/types";
import { ACCENT_SWATCHES, selectedSwatchRing } from "./accentSwatches";

export type SwatchesProps = {
  value: AccentColor;
  onChange: (value: AccentColor) => void;
};

export function Swatches({ value, onChange }: SwatchesProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme accent"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {ACCENT_SWATCHES.map((color) => {
        const selected = color === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            onClick={() => {
              onChange(color);
            }}
            style={{
              width: 18,
              height: 18,
              borderRadius: "var(--radius-pill)",
              border: "none",
              padding: 0,
              cursor: "pointer",
              background: color,
              boxShadow: selected ? selectedSwatchRing(color) : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
