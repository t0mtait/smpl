import type { ReactNode } from "react";

/* ------------------------------------------------------------------
   Score ring — a donut gauge for the 0-100 declutter score.
   ------------------------------------------------------------------ */

export function ScoreRing({
  score,
  size = 64,
  stroke = 6,
  label,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = c * (1 - pct / 100);
  // The tone follows the score: high reads as clay (get rid of it),
  // middling as warn, low as moss (keep it). These are token classes, not
  // baked-in hexes, so the ring follows the palette in both modes — the
  // old literals were light-mode-only and vanished on a dark background.
  const tone = pct >= 70 ? "stroke-clay" : pct >= 40 ? "stroke-warn" : "stroke-accent";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[15px] font-semibold leading-none text-ink">{Math.round(pct)}</span>
        {label ? <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-muted">{label}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Stat tile
   ------------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "moss" | "clay";
  href?: string;
}) {
  const tones = {
    neutral: "bg-paper text-muted",
    moss: "bg-accent-soft text-accent",
    clay: "bg-clay-soft text-clay",
  };

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="eyebrow">{label}</span>
        {icon ? (
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-ink">{value}</div>
      {sub ? <div className="mt-1 text-[13px] leading-snug text-muted">{sub}</div> : null}
    </>
  );

  const cls = "card card-hover block p-5";
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/* ------------------------------------------------------------------
   Bar chart — horizontal, used for category / frequency breakdowns.
   ------------------------------------------------------------------ */

export function BarRow({
  label,
  value,
  max,
  suffix,
  tone = "moss",
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  tone?: "moss" | "clay" | "ink";
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const tones = {
    moss: "bg-accent-mark",
    clay: "bg-clay-mark",
    ink: "bg-chart-ink",
  };

  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="truncate text-ink-soft">{label}</span>
        <span className="tabular shrink-0 font-medium text-ink">
          {value}
          {suffix ? <span className="ml-0.5 text-muted">{suffix}</span> : null}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-wash">
        <div
          className={`h-full rounded-full ${tones[tone]} transition-all duration-500`}
          style={{ width: `${Math.max(pct, value > 0 ? 3 : 0)}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Sparkline / earnings chart
   ------------------------------------------------------------------ */

export function EarningsChart({ data }: { data: { month: string; amount: number }[] }) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted">
        No sales yet — the chart fills in as things find new homes.
      </div>
    );
  }

  const w = 640;
  const h = 180;
  const pad = { top: 16, right: 8, bottom: 26, left: 46 };
  const max = Math.max(...data.map((d) => d.amount), 1);
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const x = (i: number) =>
    pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.amount).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(data.length - 1).toFixed(1)} ${(pad.top + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(
    pad.top + innerH
  ).toFixed(1)} Z`;

  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Earnings by month">
        <defs>
          {/* The stops inherit `color` from this element, so `currentColor`
              resolves to the accent token and the gradient follows the
              palette in both modes. */}
          <linearGradient id="earnFill" x1="0" y1="0" x2="0" y2="1" className="text-accent">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={y(t)}
              y2={y(t)}
              className="stroke-line"
              strokeWidth="1"
            />
            <text
              x={pad.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize="10"
              className="tabular fill-chart-ink"
            >
              ${t}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#earnFill)" />
        <path
          d={line}
          fill="none"
          className="stroke-accent"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(d.amount)}
              r="3.5"
              className="fill-card stroke-accent"
              strokeWidth="2"
            />
            <text
              x={x(i)}
              y={h - 8}
              textAnchor="middle"
              fontSize="10"
              className="fill-chart-ink"
            >
              {d.month}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------
   Empty state
   ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-paper text-ink-faint">
          {icon}
        </div>
      ) : null}
      <h3 className="display text-xl">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------
   Photo thumbnail with graceful placeholder
   ------------------------------------------------------------------ */

export function ItemPhoto({
  src,
  alt,
  className = "",
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div className={`photo-empty ${className}`}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
          <path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`h-full w-full object-cover ${className}`} />
  );
}

/* ------------------------------------------------------------------
   Section heading — the eyebrow + serif title pairing used across
   the app's panels.
   ------------------------------------------------------------------ */

export function SectionHeading({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h2 className="display text-xl tracking-[-0.01em]">{title}</h2>
        {sub ? <p className="mt-1 text-[13px] leading-snug text-muted">{sub}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------
   Status tag — a tag-shaped badge with an eyelet hole for item statuses.
   ------------------------------------------------------------------ */

export function StatusTag({
  status,
  className = "",
}: {
  status: { key?: string; label: string; style: string };
  className?: string;
}) {
  return (
    <span className={`status-tag ${status.style} ${className}`} title={status.label}>
      <span className="status-tag-eyelet" aria-hidden="true" />
      <span>{status.label}</span>
    </span>
  );
}
