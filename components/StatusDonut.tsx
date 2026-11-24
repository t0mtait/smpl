"use client";

import { useState } from "react";

export interface DonutSlice {
  label: string;
  value: number;
  /** Tailwind stroke + background classes, e.g. "stroke-accent". */
  stroke: string;
  dot: string;
}

/** Interactive donut chart with slice hovering, detail tooltip and legend highlight. */
export function StatusDonut({ slices }: { slices: DonutSlice[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  let offset = 0;

  return (
    <div className="flex flex-row items-center gap-3 sm:gap-6">
      <div className="relative flex shrink-0 items-center justify-center">
        <svg
          viewBox="0 0 100 100"
          className="h-28 w-28 sm:h-44 sm:w-44 -rotate-90 transition-transform duration-200"
          role="img"
          aria-label="Items by status"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Base ring */}
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" className="stroke-wash" />

          {total > 0 &&
            slices.map((s, idx) => {
              if (s.value <= 0) return null;
              const len = (s.value / total) * c;
              const currentOffset = offset;
              offset += len;

              const isHovered = hoveredIdx === idx;
              const isOtherHovered = hoveredIdx !== null && !isHovered;

              return (
                <circle
                  key={s.label}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  strokeWidth={isHovered ? 15 : 12}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-currentOffset}
                  className={`${s.stroke} cursor-pointer transition-all duration-200 ${
                    isOtherHovered ? "opacity-35" : "opacity-100"
                  }`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                />
              );
            })}

          {/* Center text */}
          <g className="rotate-90 origin-center pointer-events-none select-none">
            {activeSlice ? (
              <>
                <text
                  x="50"
                  y="46"
                  textAnchor="middle"
                  className="fill-ink text-[15px] font-bold"
                >
                  {activeSlice.value}
                </text>
                <text
                  x="50"
                  y="57"
                  textAnchor="middle"
                  className="fill-muted text-[6.5px] font-semibold uppercase tracking-wider"
                >
                  {activeSlice.label}
                </text>
                <text
                  x="50"
                  y="66"
                  textAnchor="middle"
                  className="fill-accent text-[6px] font-medium"
                >
                  {total > 0 ? `${Math.round((activeSlice.value / total) * 100)}%` : "0%"}
                </text>
              </>
            ) : (
              <>
                <text
                  x="50"
                  y="49"
                  textAnchor="middle"
                  className="fill-ink text-[16px] font-bold"
                >
                  {total}
                </text>
                <text
                  x="50"
                  y="61"
                  textAnchor="middle"
                  className="fill-muted text-[7px] uppercase tracking-wider"
                >
                  total items
                </text>
              </>
            )}
          </g>
        </svg>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-1 sm:space-y-1.5 text-xs sm:text-[13px]">
        {slices.map((s, idx) => {
          const isHovered = hoveredIdx === idx;
          const isOther = hoveredIdx !== null && !isHovered;
          return (
            <li
              key={s.label}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 cursor-pointer transition-all ${
                isHovered
                  ? "bg-wash/80 font-semibold"
                  : isOther
                  ? "opacity-50 hover:opacity-80"
                  : "hover:bg-wash/50"
              }`}
            >
              <span className="flex items-center gap-2 text-ink-soft">
                <span
                  className={`h-2.5 w-2.5 rounded-full transition-transform ${
                    isHovered ? "scale-125" : ""
                  } ${s.dot}`}
                />
                <span className={isHovered ? "text-ink font-semibold" : ""}>{s.label}</span>
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
          );
        })}
      </ul>
    </div>
  );
}
