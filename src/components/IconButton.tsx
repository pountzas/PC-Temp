import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  IconClose,
  IconCollapse,
  IconExpand,
  IconGear,
  IconPin,
} from "./icons";

export type IconButtonId = "gear" | "expand" | "collapse" | "pin" | "close";

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  icon: IconButtonId;
  active?: boolean;
  label: string;
};

function iconFor(id: IconButtonId, active: boolean): ReactNode {
  switch (id) {
    case "gear":
      return <IconGear />;
    case "expand":
      return <IconExpand />;
    case "collapse":
      return <IconCollapse />;
    case "pin":
      return <IconPin active={active} />;
    case "close":
      return <IconClose />;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function IconButton({
  icon,
  active = false,
  label,
  style,
  ...rest
}: IconButtonProps) {
  const baseStyle = {
    width: 24,
    height: 24,
    borderRadius: "var(--radius-sm)",
    border: "none",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      active && icon === "pin" ? "var(--color-accent-bg)" : "transparent",
    cursor: "pointer",
    outlineColor: "var(--color-muted)",
    ...style,
  } as const;

  return (
    <button type="button" aria-label={label} style={baseStyle} {...rest}>
      {iconFor(icon, active)}
    </button>
  );
}
