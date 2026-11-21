import { useEffect, useRef, useState, type ChangeEvent } from "react";

const THROTTLE_MS = 100;

export type SliderProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
};

export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
}: SliderProps) {
  const [draftOverride, setDraftOverride] = useState<number | null>(null);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (throttleRef.current !== null) {
        clearTimeout(throttleRef.current);
      }
    };
  }, []);

  const raw =
    draftOverride !== null && draftOverride !== value ? draftOverride : value;
  const pct = Math.min(max, Math.max(min, raw));
  const fillWidth = max > min ? ((pct - min) / (max - min)) * 110 : 0;
  const thumbLeft = Math.max(0, Math.min(110 - 14, fillWidth - 7));

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    setDraftOverride(next);
    if (throttleRef.current !== null) {
      clearTimeout(throttleRef.current);
    }
    throttleRef.current = setTimeout(() => {
      onChangeRef.current(next);
    }, THROTTLE_MS);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          position: "relative",
          width: 110,
          height: 14,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 5,
            width: 110,
            height: 4,
            borderRadius: "var(--radius-pill)",
            background: "rgba(255,255,255,0.1)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 5,
            width: fillWidth,
            height: 4,
            borderRadius: "var(--radius-pill)",
            background: "var(--color-cpu)",
            boxShadow: "0 0 8px var(--color-cpu)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: thumbLeft,
            top: 0,
            width: 14,
            height: 14,
            borderRadius: "var(--radius-pill)",
            background: "var(--color-text)",
            boxShadow: "0 0 0 3px rgba(34,229,255,0.3)",
            pointerEvents: "none",
          }}
        />
        <input
          type="range"
          aria-label={`${label} slider`}
          min={min}
          max={max}
          value={pct}
          onChange={handleChange}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            margin: 0,
            opacity: 0,
            cursor: "pointer",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          lineHeight: "14px",
          color: "var(--color-text)",
          width: 30,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {pct}%
      </span>
    </div>
  );
}
