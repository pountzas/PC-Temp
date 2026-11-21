import type { MouseEvent, ReactNode } from "react";
import { startDrag } from "../window/drag";
import { IconGrip } from "./icons";
import { IconButton, type IconButtonProps } from "./IconButton";

export type HeaderButton = Pick<IconButtonProps, "icon" | "active" | "label"> &
  Omit<IconButtonProps, "icon" | "active" | "label">;

export type HeaderProps = {
  chip?: ReactNode;
  buttons?: HeaderButton[];
  onDragStart?: (e: MouseEvent) => void;
};

const headerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: 24,
  flexShrink: 0,
} as const;

const groupRight = {
  display: "flex",
  alignItems: "center",
  gap: 2,
} as const;

const wordmark = {
  fontFamily: "var(--font-display)",
  fontWeight: "var(--font-weight-bold)",
  fontSize: 12,
  lineHeight: "14px",
  letterSpacing: "0.22em",
  color: "var(--color-text)",
} as const;

function dragRegionProps(onDrag: (e: MouseEvent) => void) {
  return {
    onMouseDown: onDrag,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      cursor: "default" as const,
    },
  };
}

export function Header({ chip, buttons = [], onDragStart }: HeaderProps) {
  const onDrag = onDragStart ?? startDrag;

  return (
    <header style={headerRow}>
      <div {...dragRegionProps(onDrag)}>
        <IconGrip />
        <span style={wordmark}>PC-TEMP</span>
        {chip}
      </div>
      <div style={groupRight}>
        {buttons.map((btn) => {
          const { icon, active, label, ...rest } = btn;
          return (
            <IconButton
              key={icon + label}
              icon={icon}
              active={active}
              label={label}
              {...rest}
            />
          );
        })}
      </div>
    </header>
  );
}
