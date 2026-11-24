export interface DonutSlice {
  label: string;
  value: number;
  /** Tailwind stroke + background classes, e.g. "stroke-accent". */
  stroke: string;
  dot: string;
}

/** Server-rendered donut showing how the whole inventory splits by status. */
export function StatusDonut({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 100 100" className="h-40 w-40 shrink-0 -rotate-90" role="img" aria-label="Items by status">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" className="stroke-wash" />
        {total > 0 &&
          slices
            .filter((s) => s.value > 0)
            .map((s) => {
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={s.label}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  strokeWidth="12"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  className={s.stroke}
                >
                  <title>{`${s.label}: ${s.value}`}</title>
                </circle>
              );
              offset += len;
              return el;
            })}
        <g className="rotate-90 origin-center">
          <text x="50" y="50" textAnchor="middle" className="fill-ink text-[16px] font-semibold">
            {total}
          </text>
          <text x="50" y="62" textAnchor="middle" className="fill-muted text-[6px]">
            items
          </text>
        </g>
      </svg>
      <ul className="w-full space-y-1.5 text-[13px]">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-ink-soft">
              <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
              {s.label}
            </span>
            <span className="tabular font-medium">
              {s.value}
              {total > 0 && (
                <span className="ml-1.5 text-[11px] font-normal text-muted">
                  {Math.round((s.value / total) * 100)}%
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
