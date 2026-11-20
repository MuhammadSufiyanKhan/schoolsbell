import clsx from "clsx";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p
        className={clsx(
          "mt-2 text-3xl font-semibold tabular-nums",
          tone === "good" && "text-good",
          tone === "warn" && "text-warn",
          tone === "bad" && "text-bad",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "good" | "warn" | "bad" | "neutral" | "brand";
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "good" && "bg-good-soft text-good",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "bad" && "bg-bad-soft text-bad",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "neutral" && "bg-border text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[560px] divide-y divide-border">{children}</table>
    </div>
  );
}

export const money = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
