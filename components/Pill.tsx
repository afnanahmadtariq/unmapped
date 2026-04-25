import clsx from "clsx";

type Tone = "neutral" | "positive" | "warning" | "danger" | "accent";

const TONE: Record<Tone, string> = {
  neutral: "border-border-default bg-bg-raised text-fg-secondary",
  positive: "border-positive/30 bg-positive/10 text-positive",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  accent: "border-accent/30 bg-accent/10 text-accent",
};

export default function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
