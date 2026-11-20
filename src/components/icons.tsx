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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx={12} cy={12} r={3} />
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
      <path d="M12 17v5" />
      <path d="M9 3h6" />
      <path d="M12 3v9" />
      <path d="m9 12-2 4.5a1.5 1.5 0 0 0 1.36 2.12h9.28a1.5 1.5 0 0 0 1.36-2.12L18 12" />
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
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}