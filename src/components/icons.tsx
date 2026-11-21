import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  active?: boolean;
};

const strokeDefaults = {
  fill: "none",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconGrip(props: SVGProps<SVGSVGElement>) {
  const circles = [
    [2, 2],
    [8, 2],
    [2, 7],
    [8, 7],
    [2, 12],
    [8, 12],
  ];
  return (
    <svg
      width={10}
      height={14}
      viewBox="0 0 10 14"
      aria-hidden
      {...props}
    >
      {circles.map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={1.2}
          fill="var(--color-faint)"
        />
      ))}
    </svg>
  );
}

export function IconGear(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      aria-hidden
      {...strokeDefaults}
      stroke="var(--color-muted)"
      strokeWidth={2}
      {...props}
    >
      <circle cx={12} cy={12} r={3} />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </svg>
  );
}

export function IconExpand(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      aria-hidden
      {...strokeDefaults}
      stroke="var(--color-muted)"
      strokeWidth={2}
      {...props}
    >
      <path d="M14 4h6v6M10 20H4v-6" />
    </svg>
  );
}

export function IconCollapse(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      aria-hidden
      {...strokeDefaults}
      stroke="var(--color-muted)"
      strokeWidth={2}
      {...props}
    >
      <path d="M4 14h6v6M20 10h-6V4" />
    </svg>
  );
}

export function IconPin({ active = false, ...props }: IconProps) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      aria-hidden
      {...strokeDefaults}
      stroke={active ? "var(--color-cpu)" : "var(--color-muted)"}
      strokeWidth={2}
      {...props}
    >
      <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z" />
    </svg>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      aria-hidden
      {...strokeDefaults}
      stroke="var(--color-muted)"
      strokeWidth={2.2}
      {...props}
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}