import clsx from "clsx";

type Tone = "neutral" | "positive" | "warning" | "danger" | "accent";

const TONE: Record<Tone, string> = {
  neutral: "border-neutral-700 bg-neutral-900/60 text-neutral-300",
  positive: "border-emerald-700/40 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-700/40 bg-amber-500/10 text-amber-300",
  danger: "border-rose-700/40 bg-rose-500/10 text-rose-300",
  accent: "border-sky-700/40 bg-sky-500/10 text-sky-300",
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
