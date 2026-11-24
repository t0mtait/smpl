"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";

function formatQuarterLabel(q: string): string {
  const m = /^Q([1-4])\s*(?:20)?(\d{2})$/i.exec(q.trim());
  if (m) {
    return `Q${m[1]} '${m[2]}`;
  }
  return q;
}

export function QuarterlyChangeChart({
  data,
}: {
  data: {
    quarter: string;
    itemsCount: number;
    itemsChangePct: number;
    totalValue: number;
    valueChangePct: number;
  }[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-36 items-center justify-center text-sm text-muted">
        No quarterly trend data available yet.
      </div>
    );
  }

  const w = 640;
  const h = 180;
  const pad = { top: 22, right: 24, bottom: 28, left: 52 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  // Determine min and max percentage across both series
  let allPcts = data.flatMap((d) => [d.itemsChangePct, d.valueChangePct]);
  if (allPcts.length === 0) allPcts = [0];
  let minPct = Math.min(...allPcts, -10);
  let maxPct = Math.max(...allPcts, 10);
  minPct = Math.floor(minPct / 10) * 10;
  maxPct = Math.ceil(maxPct / 10) * 10;
  if (minPct === maxPct) {
    minPct -= 10;
    maxPct += 10;
  }
  const range = maxPct - minPct;

  const x = (i: number) =>
    pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (pct: number) => pad.top + innerH - ((pct - minPct) / range) * innerH;

  const zeroY = y(0);

  const itemsLine = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.itemsChangePct).toFixed(1)}`)
    .join(" ");

  const valueLine = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.valueChangePct).toFixed(1)}`)
    .join(" ");

  const ticks = [minPct, Math.round(minPct + range * 0.5), maxPct];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * w;
    if (svgX < pad.left) {
      setHoveredIdx(0);
      return;
    }
    if (svgX > w - pad.right) {
      setHoveredIdx(data.length - 1);
      return;
    }
    const fraction = (svgX - pad.left) / innerW;
    const idx = Math.min(data.length - 1, Math.max(0, Math.round(fraction * (data.length - 1))));
    setHoveredIdx(idx);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!e.touches[0]) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const svgX = (touchX / rect.width) * w;
    const fraction = Math.min(1, Math.max(0, (svgX - pad.left) / innerW));
    const idx = Math.min(data.length - 1, Math.max(0, Math.round(fraction * (data.length - 1))));
    setHoveredIdx(idx);
  };

  const active = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="relative w-full overflow-hidden" onMouseLeave={() => setHoveredIdx(null)}>
      {/* Top Bar: Either Legend or Hovered Quarter Summary */}
      <div className="mb-2.5 flex min-h-[22px] flex-wrap items-center justify-between gap-3 text-xs">
        {active ? (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">{active.quarter}:</span>
            <span className="text-muted">
              {active.itemsCount} items (
              <span className={active.itemsChangePct >= 0 ? "font-medium text-accent" : "font-medium text-clay"}>
                {active.itemsChangePct > 0 ? `+${active.itemsChangePct}%` : `${active.itemsChangePct}%`}
              </span>
              )
            </span>
            <span className="text-line">•</span>
            <span className="text-muted">
              {formatMoney(active.totalValue)} value (
              <span className={active.valueChangePct >= 0 ? "font-medium text-clay" : "font-medium text-accent"}>
                {active.valueChangePct > 0 ? `+${active.valueChangePct}%` : `${active.valueChangePct}%`}
              </span>
              )
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-muted">
            Hover or tap along the chart to inspect quarterly metrics
          </div>
        )}

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="font-medium text-ink-soft">Items owned (% chg)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-clay" />
            <span className="font-medium text-ink-soft">Inventory value (% chg)</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full cursor-crosshair select-none"
          role="img"
          aria-label="Quarterly change in inventory value and items count"
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchMove}
        >
          {/* Zero baseline */}
          {zeroY >= pad.top && zeroY <= pad.top + innerH && (
            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={zeroY}
              y2={zeroY}
              className="stroke-line-strong"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}

          {/* Horizontal Grid lines and percentage Ticks */}
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
                {t > 0 ? `+${t}%` : `${t}%`}
              </text>
            </g>
          ))}

          {/* Hover guideline vertical rule */}
          {hoveredIdx !== null && (
            <line
              x1={x(hoveredIdx)}
              x2={x(hoveredIdx)}
              y1={pad.top}
              y2={h - pad.bottom}
              className="stroke-ink/40 pointer-events-none"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Items Line (Moss / Accent) */}
          <path
            d={itemsLine}
            fill="none"
            className="stroke-accent"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Value Line (Clay / Terracotta) */}
          <path
            d={valueLine}
            fill="none"
            className="stroke-clay"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points & X-axis labels */}
          {data.map((d, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <g key={i}>
                <circle
                  cx={x(i)}
                  cy={y(d.itemsChangePct)}
                  r={isHovered ? "6" : "4"}
                  className={`fill-card stroke-accent transition-all ${isHovered ? "stroke-[3px]" : "stroke-2"}`}
                />

                <circle
                  cx={x(i)}
                  cy={y(d.valueChangePct)}
                  r={isHovered ? "6" : "4"}
                  className={`fill-card stroke-clay transition-all ${isHovered ? "stroke-[3px]" : "stroke-2"}`}
                />

                <text
                  x={x(i)}
                  y={h - 6}
                  textAnchor="middle"
                  fontSize="11"
                  className={`tabular transition-colors ${isHovered ? "fill-ink font-semibold" : "fill-chart-ink"}`}
                >
                  {formatQuarterLabel(d.quarter)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip Card */}
        {active && hoveredIdx !== null && (
          <div
            className={`pointer-events-none absolute top-3 z-20 rounded-xl border border-line bg-card/95 p-3 shadow-lift backdrop-blur transition-all duration-75 text-xs ${
              hoveredIdx <= 1
                ? "left-3 sm:left-14"
                : hoveredIdx >= data.length - 2
                ? "right-3 sm:right-8"
                : "-translate-x-1/2"
            }`}
            style={
              hoveredIdx > 1 && hoveredIdx < data.length - 2
                ? { left: `${(x(hoveredIdx) / w) * 100}%` }
                : undefined
            }
          >
            <div className="font-semibold text-ink border-b border-line pb-1.5 mb-2">
              {active.quarter}
            </div>
            <div className="space-y-1.5 tabular">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                  Items owned:
                </span>
                <span className="font-semibold text-ink">
                  {active.itemsCount}{" "}
                  <span className={active.itemsChangePct >= 0 ? "text-accent" : "text-clay"}>
                    ({active.itemsChangePct > 0 ? `+${active.itemsChangePct}%` : `${active.itemsChangePct}%`})
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="inline-block h-2 w-2 rounded-full bg-clay" />
                  Total value:
                </span>
                <span className="font-semibold text-ink">
                  {formatMoney(active.totalValue)}{" "}
                  <span className={active.valueChangePct >= 0 ? "text-clay" : "text-accent"}>
                    ({active.valueChangePct > 0 ? `+${active.valueChangePct}%` : `${active.valueChangePct}%`})
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
