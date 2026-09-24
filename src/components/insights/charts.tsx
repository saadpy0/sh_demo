"use client"

import { formatListPrice } from "@/lib/catalog/money"
import type { MixSlice, PacePoint, RankRow } from "@/lib/insights/types"
import { useId } from "react"

export const CHART = {
  copper: "#c24e12",
  slate: "#3d5a80",
  brass: "#c9a227",
  leaf: "#2f6f4e",
  wine: "#8c3d55",
  ink: "#1c2026",
  mute: "#9aa3ad",
}

export const PALETTE = [CHART.copper, CHART.slate, CHART.brass, CHART.leaf, CHART.wine, "#5c6570"]

export function brandColor(brand: string, index = 0) {
  if (brand === "Aura") return CHART.copper
  if (brand === "Laksh") return CHART.brass
  if (brand.includes("Decor")) return CHART.slate
  return PALETTE[index % PALETTE.length]
}

function niceMax(value: number) {
  if (value <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(value)))
  return Math.ceil(value / exp) * exp
}

function line(values: number[], width: number, height: number, pad = 8) {
  const max = niceMax(Math.max(...values, 1))
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  return values.map((value, index) => {
    const x = pad + (values.length === 1 ? innerW / 2 : (index / (values.length - 1)) * innerW)
    const y = pad + innerH - (value / max) * innerH
    return { x, y }
  })
}

function toPath(points: Array<{ x: number; y: number }>, closeY?: number) {
  if (!points.length) return ""
  const d = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ")
  if (closeY == null) return d
  const first = points[0]
  const last = points[points.length - 1]
  return `${d} L${last.x.toFixed(1)} ${closeY} L${first.x.toFixed(1)} ${closeY} Z`
}

export function PaceChart({ points }: { points: PacePoint[] }) {
  const id = useId().replace(/:/g, "")
  const width = 720
  const height = 220
  const sold = points.map((point) => point.soldQty)
  const revenue = points.map((point) => point.revenue)
  const soldPts = line(sold, width, height, 28)
  const revPts = line(revenue, width, height, 28)
  const ticks = points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0)
  const peak = points.reduce((best, point) => (point.soldQty > best.soldQty ? point : best), points[0] || { soldQty: 0, label: "", revenue: 0 })

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full" role="img" aria-label="Pieces sold over the period">
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.copper} stopOpacity="0.38" />
            <stop offset="100%" stopColor={CHART.copper} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1="28"
            x2={width - 8}
            y1={28 + (height - 56) * t}
            y2={28 + (height - 56) * t}
            stroke="currentColor"
            className="text-border"
            strokeDasharray="3 5"
          />
        ))}
        <path d={toPath(soldPts, height - 28)} fill={`url(#${id}-fill)`} />
        <path d={toPath(soldPts)} fill="none" stroke={CHART.copper} strokeWidth="2.4" strokeLinejoin="round" />
        <path d={toPath(revPts)} fill="none" stroke={CHART.brass} strokeWidth="2" strokeDasharray="5 4" />
        {soldPts.map((point, index) =>
          sold[index] > 0 ? (
            <circle key={points[index].key} cx={point.x} cy={point.y} r="2.4" fill={CHART.copper} />
          ) : null
        )}
        {ticks.map((point) => {
          const index = points.indexOf(point)
          const x = soldPts[index]?.x ?? 0
          return (
            <text key={point.key} x={x} y={height - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="11">
              {point.label}
            </text>
          )
        })}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2 rounded-full" style={{ background: CHART.copper }} />
          Pieces sold
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: CHART.brass }} />
          Revenue (scaled)
        </span>
        {peak ? (
          <span className="ml-auto font-medium text-foreground">
            Peak {peak.label}: {peak.soldQty} pcs · {formatListPrice(peak.revenue)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function HBars({
  rows,
  value,
  format = String,
}: {
  rows: RankRow[]
  value: (row: RankRow) => number
  format?: (n: number) => string
}) {
  const max = Math.max(...rows.map((row) => value(row)), 1)
  return (
    <ul className="space-y-2.5">
      {rows.slice(0, 8).map((row, index) => {
        const n = value(row)
        return (
          <li key={row.code}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium">{row.code}</p>
              <p className="font-mono text-xs tabular-nums text-muted-foreground">{format(n)}</p>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{row.itemName}</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(4, (n / max) * 100)}%`,
                  background: brandColor(row.brand, index),
                }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function Donut({ slices, title }: { slices: MixSlice[]; title: string }) {
  const id = useId().replace(/:/g, "")
  const total = slices.reduce((sum, slice) => sum + slice.revenue, 0) || 1
  const r = 42
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="size-36 shrink-0" role="img" aria-label={title}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="14" />
        {slices.slice(0, 6).map((slice, index) => {
          const frac = slice.revenue / total
          const dash = frac * c
          const el = (
            <circle
              key={slice.label}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={brandColor(slice.label, index)}
              strokeWidth="14"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          )
          offset += dash
          return el
        })}
        <text x="60" y="56" textAnchor="middle" className="fill-muted-foreground" fontSize="9">
          {title}
        </text>
        <text x="60" y="72" textAnchor="middle" className="fill-foreground" fontSize="11" fontWeight="600">
          {formatListPrice(total)}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {slices.slice(0, 6).map((slice, index) => (
          <li key={slice.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <i className="size-2 shrink-0 rounded-full" style={{ background: brandColor(slice.label, index) }} />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {Math.round((slice.revenue / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
      <span className="sr-only">{id}</span>
    </div>
  )
}

export function Spark({ values, color = CHART.copper }: { values: number[]; color?: string }) {
  const width = 88
  const height = 28
  const pts = line(values, width, height, 2)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-[88px]" aria-hidden>
      <path d={toPath(pts)} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export function Diverging({
  rows,
}: {
  rows: Array<{ code: string; brand: string; delta?: number; qty: number; prevQty: number }>
}) {
  const data = rows.map((row) => ({ ...row, delta: row.delta ?? row.qty - row.prevQty }))
  const max = Math.max(...data.map((row) => Math.abs(row.delta)), 1)
  return (
    <ul className="space-y-2">
      {data.slice(0, 8).map((row) => {
        const up = row.delta >= 0
        const w = (Math.abs(row.delta) / max) * 50
        return (
          <li key={row.code} className="grid grid-cols-[1fr_3rem_1fr] items-center gap-1 text-xs">
            <div className="flex justify-end">
              {!up ? (
                <span
                  className="h-2 rounded-l-full"
                  style={{ width: `${w}%`, background: CHART.wine, minWidth: 6 }}
                />
              ) : null}
            </div>
            <p className="truncate text-center font-mono" title={row.code}>
              {row.code.split(" ")[0]}
            </p>
            <div className="flex justify-start">
              {up ? (
                <span
                  className="h-2 rounded-r-full"
                  style={{ width: `${w}%`, background: CHART.leaf, minWidth: 6 }}
                />
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function Funnel({ quoted, confirmed, soldQty }: { quoted: number; confirmed: number; soldQty: number }) {
  const steps = [
    { label: "Quoted", n: quoted, color: CHART.slate },
    { label: "Confirmed", n: confirmed, color: CHART.copper },
    { label: "Pieces out", n: soldQty, color: CHART.brass },
  ]
  const max = Math.max(...steps.map((step) => step.n), 1)
  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div key={step.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span>{step.label}</span>
            <span className="font-mono tabular-nums">{step.n}</span>
          </div>
          <div className="h-7 overflow-hidden rounded-md bg-muted">
            <div
              className="flex h-full items-center px-2 text-[11px] font-medium text-white"
              style={{ width: `${Math.max(12, (step.n / max) * 100)}%`, background: step.color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ScatterShelf({
  rows,
}: {
  rows: Array<{ code: string; brand: string; qty: number; onHand: number; onHandValue: number }>
}) {
  const width = 420
  const height = 220
  const pad = 32
  const xs = rows.map((row) => row.qty)
  const ys = rows.map((row) => row.onHand)
  const maxX = niceMax(Math.max(...xs, 1))
  const maxY = niceMax(Math.max(...ys, 1))
  const maxV = Math.max(...rows.map((row) => row.onHandValue), 1)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full" role="img" aria-label="Shelf quantity versus pieces sold">
      <line x1={pad} y1={height - pad} x2={width - 8} y2={height - pad} stroke="currentColor" className="text-border" />
      <line x1={pad} y1={12} x2={pad} y2={height - pad} stroke="currentColor" className="text-border" />
      <text x={width / 2} y={height - 8} textAnchor="middle" fontSize="10" className="fill-muted-foreground">
        Sold this period →
      </text>
      <text x="12" y="14" fontSize="10" className="fill-muted-foreground">
        On shelf
      </text>
      {rows.slice(0, 28).map((row, index) => {
        const x = pad + (row.qty / maxX) * (width - pad - 16)
        const y = height - pad - (row.onHand / maxY) * (height - pad - 20)
        const r = 4 + Math.sqrt(row.onHandValue / maxV) * 10
        return (
          <circle key={row.code} cx={x} cy={y} r={r} fill={brandColor(row.brand, index)} fillOpacity="0.72" stroke="white" strokeWidth="1">
            <title>
              {row.code}: {row.onHand} on shelf, {row.qty} sold
            </title>
          </circle>
        )
      })}
    </svg>
  )
}

export function StackedPair({ aLabel, a, bLabel, b }: { aLabel: string; a: number; bLabel: string; b: number }) {
  const total = a + b || 1
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs text-muted-foreground">
        <span>
          {aLabel} · {a}
        </span>
        <span>
          {bLabel} · {b}
        </span>
      </div>
      <div className="flex h-4 overflow-hidden rounded-full">
        <div style={{ width: `${(a / total) * 100}%`, background: CHART.copper }} />
        <div style={{ width: `${(b / total) * 100}%`, background: CHART.brass }} />
      </div>
    </div>
  )
}

export function WeekBars({ days }: { days: Array<{ weekday: number; qty: number }> }) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const max = Math.max(...days.map((day) => day.qty), 1)
  return (
    <div className="flex h-36 items-end gap-2">
      {days.map((day) => (
        <div key={day.weekday} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{day.qty}</span>
          <div
            className="w-full min-h-1.5 rounded-t-md"
            style={{
              height: `${Math.max(8, (day.qty / max) * 100)}%`,
              background: day.weekday === 0 || day.weekday === 6 ? CHART.slate : CHART.copper,
            }}
          />
          <span className="text-[10px] text-muted-foreground">{labels[day.weekday]}</span>
        </div>
      ))}
    </div>
  )
}

export function AttachFlow({
  pairs,
}: {
  pairs: Array<{ a: string; b: string; count: number }>
}) {
  const max = Math.max(...pairs.map((pair) => pair.count), 1)
  return (
    <ul className="space-y-3">
      {pairs.slice(0, 8).map((pair) => (
        <li key={`${pair.a}-${pair.b}`}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="font-mono">
              {pair.a} <span className="text-muted-foreground">+</span> {pair.b}
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">{pair.count} jobs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] text-white" style={{ background: CHART.copper }}>
              {pair.a.split(" ")[0]}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${(pair.count / max) * 100}%`, background: CHART.brass }} />
            </div>
            <span className="rounded-full px-2 py-0.5 text-[10px] text-white" style={{ background: CHART.slate }}>
              {pair.b.split(" ")[0]}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function HeatGrid({
  cells,
  months,
  days,
}: {
  cells: Array<{ month: number; weekday: number; qty: number }>
  months: string[]
  days: string[]
}) {
  const max = Math.max(...cells.map((cell) => cell.qty), 1)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-[11px]">
        <thead>
          <tr>
            <th className="px-1 py-1 text-left font-medium text-muted-foreground" />
            {months.map((month) => (
              <th key={month} className="px-1 py-1 font-medium text-muted-foreground">
                {month}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day, weekday) => (
            <tr key={day}>
              <td className="px-1 py-1 text-left text-muted-foreground">{day}</td>
              {months.map((_, month) => {
                const qty = cells.find((cell) => cell.month === month && cell.weekday === weekday)?.qty || 0
                const t = qty / max
                return (
                  <td key={`${day}-${month}`} className="px-0.5 py-0.5">
                    <span
                      title={`${qty} pcs`}
                      className="mx-auto block size-7 rounded-sm"
                      style={{
                        background: qty
                          ? `color-mix(in oklab, ${CHART.copper} ${Math.round(22 + t * 78)}%, #eceef1)`
                          : "var(--muted)",
                      }}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
