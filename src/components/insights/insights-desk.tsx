"use client"

import {
  AttachFlow,
  CHART,
  Diverging,
  Donut,
  Funnel,
  HBars,
  HeatGrid,
  PaceChart,
  ScatterShelf,
  Spark,
  StackedPair,
  WeekBars,
  brandColor,
} from "@/components/insights/charts"
import { BriefDesk } from "@/components/insights/brief-desk"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatQuotationDate } from "@/lib/catalog/format-date"
import { formatListPrice } from "@/lib/catalog/money"
import { computeInsights, uniqueOptions } from "@/lib/insights/compute"
import { DEMO_ROSTER } from "@/lib/insights/demo-roster"
import { buildDemoLedger } from "@/lib/insights/ledger"
import { PERIOD_OPTIONS, resolvePeriod } from "@/lib/insights/period"
import { compactInsights } from "@/lib/insights/snapshot"
import type { InsightFilters, PeriodKey, RankRow } from "@/lib/insights/types"
import { useEffect, useMemo, useState } from "react"

const emptyFilters: InsightFilters = {
  brand: "",
  category: "",
  collection: "",
  finish: "",
  size: "",
  vendor: "",
  customer: "",
  location: "",
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function deltaPct(current: number, previous: number) {
  if (!previous) return current ? 100 : 0
  return ((current - previous) / previous) * 100
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {label}
      <select
        className="h-9 rounded-lg border border-input bg-card px-2 text-sm font-normal normal-case text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  )
}

function RankTable({
  rows,
  mode,
}: {
  rows: Array<RankRow & { delta?: number }>
  mode: "sold" | "quoted" | "stock" | "order" | "money" | "move"
}) {
  if (!rows.length) {
    return <p className="px-3 py-6 text-sm text-muted-foreground">Nothing in this cut.</p>
  }
  const barOf = (row: RankRow & { delta?: number }) => {
    if (mode === "quoted") return row.quotedCount
    if (mode === "stock") return row.onHand
    if (mode === "order") return row.orderedQty
    if (mode === "money") return row.revenue
    if (mode === "move") return Math.abs(row.delta ?? row.qty - row.prevQty)
    return row.qty
  }
  const max = Math.max(...rows.map((row) => barOf(row)), 1)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2 font-medium">Item</th>
            <th className="px-3 py-2 font-medium">Share</th>
            {mode === "sold" || mode === "move" ? <th className="px-3 py-2 text-right font-medium">Sold</th> : null}
            {mode === "quoted" ? <th className="px-3 py-2 text-right font-medium">Quotes</th> : null}
            {mode === "stock" ? <th className="px-3 py-2 text-right font-medium">On shelf</th> : null}
            {mode === "order" ? <th className="px-3 py-2 text-right font-medium">Ordered</th> : null}
            {mode === "money" ? <th className="px-3 py-2 text-right font-medium">Revenue</th> : null}
            {mode === "sold" || mode === "move" ? <th className="px-3 py-2 text-right font-medium">Revenue</th> : null}
            {mode === "stock" ? <th className="px-3 py-2 text-right font-medium">Value</th> : null}
            {mode === "order" ? <th className="px-3 py-2 text-right font-medium">Open PO</th> : null}
            {mode === "quoted" ? <th className="px-3 py-2 text-right font-medium">Sold</th> : null}
            {mode === "money" ? <th className="px-3 py-2 text-right font-medium">Margin</th> : null}
            {mode === "stock" ? <th className="px-3 py-2 text-right font-medium">Cover</th> : null}
            {mode === "move" ? <th className="px-3 py-2 text-right font-medium">Change</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.code} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2.5">
                <p className="text-[11px]" style={{ color: brandColor(row.brand, index) }}>
                  {row.brand}
                </p>
                <p className="font-medium">{row.code}</p>
                <p className="text-xs text-muted-foreground">{row.itemName}</p>
              </td>
              <td className="w-28 px-3 py-2.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(6, (barOf(row) / max) * 100)}%`, background: brandColor(row.brand, index) }}
                  />
                </div>
              </td>
              {mode === "sold" || mode === "move" ? (
                <td className="px-3 py-2 text-right font-mono tabular-nums">{row.qty}</td>
              ) : null}
              {mode === "quoted" ? (
                <td className="px-3 py-2 text-right font-mono tabular-nums">{row.quotedCount}</td>
              ) : null}
              {mode === "stock" ? (
                <td className="px-3 py-2 text-right font-mono tabular-nums">{row.onHand}</td>
              ) : null}
              {mode === "order" ? (
                <td className="px-3 py-2 text-right font-mono tabular-nums">{row.orderedQty}</td>
              ) : null}
              {mode === "money" ? (
                <td className="px-3 py-2 text-right font-mono tabular-nums">{formatListPrice(row.revenue)}</td>
              ) : null}
              {mode === "sold" || mode === "move" ? (
                <td className="px-3 py-2 text-right font-mono tabular-nums">{formatListPrice(row.revenue)}</td>
              ) : null}
              {mode === "stock" ? (
                <td className="px-3 py-2 text-right font-mono tabular-nums">{formatListPrice(row.onHandValue)}</td>
              ) : null}
              {mode === "order" ? (
                <td className="px-3 py-2 text-right font-mono tabular-nums">{row.openPoQty}</td>
              ) : null}
              {mode === "quoted" ? (
                <td className="px-3 py-2 text-right font-mono tabular-nums">{row.qty}</td>
              ) : null}
              {mode === "money" ? (
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatListPrice(row.revenue - row.cost)}
                </td>
              ) : null}
              {mode === "stock" ? (
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                  {row.coverDays == null ? "—" : `${row.coverDays}d`}
                </td>
              ) : null}
              {mode === "move" ? (
                <td
                  className="px-3 py-2 text-right font-mono tabular-nums"
                  style={{ color: (row.delta ?? 0) >= 0 ? CHART.leaf : CHART.wine }}
                >
                  {(row.delta ?? row.qty - row.prevQty) > 0 ? "+" : ""}
                  {row.delta ?? row.qty - row.prevQty}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Panel({
  title,
  hint,
  children,
  className = "",
}: {
  title: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_0_rgba(28,32,38,0.04)] ${className}`}>
      <div className="border-b border-border/80 px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function InsightsDesk() {
  const [period, setPeriod] = useState<PeriodKey>("30d")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [filters, setFilters] = useState<InsightFilters>(emptyFilters)
  const [moreCuts, setMoreCuts] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  const range = useMemo(
    () => resolvePeriod(period, customStart, customEnd),
    [period, customStart, customEnd]
  )
  const ledger = useMemo(() => buildDemoLedger(DEMO_ROSTER), [])
  const options = useMemo(() => uniqueOptions(ledger), [ledger])
  const report = useMemo(
    () => computeInsights(ledger, DEMO_ROSTER, range, filters),
    [filters, ledger, range]
  )

  function setFilter<K extends keyof InsightFilters>(key: K, value: InsightFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const k = report.kpis
  const snapshot = useMemo(
    () => compactInsights(report, range.label, filters),
    [filters, range.label, report]
  )
  const soldDelta = deltaPct(k.soldQty, k.prevSoldQty)
  const revDelta = deltaPct(k.revenue, k.prevRevenue)
  const leader = report.bestQty[0]
  const coverMax = Math.max(...report.coverBuckets.map((bucket) => bucket.skuCount), 1)

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Opening the books…</p>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">Floor book</p>
          <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">
            Trends from quote and sales activity. Period and cuts drive every chart and table.
          </p>
        </div>
        <p className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {range.label} · {formatQuotationDate(range.start.toISOString())} –{" "}
          {formatQuotationDate(new Date(range.end.getTime() - 1).toISOString())}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PERIOD_OPTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPeriod(item.key)}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              period === item.key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground ring-1 ring-border hover:bg-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {period === "custom" ? (
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
          <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect label="Brand" value={filters.brand} options={options.brands} onChange={(v) => setFilter("brand", v)} />
        <FilterSelect label="Category" value={filters.category} options={options.categories} onChange={(v) => setFilter("category", v)} />
        <FilterSelect label="Customer" value={filters.customer} options={options.customers} onChange={(v) => setFilter("customer", v)} />
        <div className="flex items-end gap-2">
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setMoreCuts((open) => !open)}>
            {moreCuts ? "Fewer cuts" : "More cuts"}
          </Button>
          {filters.brand || filters.category || filters.collection || filters.finish || filters.size || filters.vendor || filters.customer ? (
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setFilters(emptyFilters)}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {moreCuts ? (
        <div className="grid gap-2 md:grid-cols-4">
          <FilterSelect label="Collection" value={filters.collection} options={options.collections} onChange={(v) => setFilter("collection", v)} />
          <FilterSelect label="Finish" value={filters.finish} options={options.finishes} onChange={(v) => setFilter("finish", v)} />
          <FilterSelect label="Size" value={filters.size} options={options.sizes} onChange={(v) => setFilter("size", v)} />
          <FilterSelect label="Vendor" value={filters.vendor} options={options.vendors} onChange={(v) => setFilter("vendor", v)} />
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">How the floor moved</h2>
            {leader ? (
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{leader.code}</span> led volume · {leader.qty} pcs ·{" "}
                {formatListPrice(leader.revenue)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: soldDelta >= 0 ? "#e7f3ec" : "#f8e8e6", color: soldDelta >= 0 ? CHART.leaf : CHART.wine }}
            >
              Sold {soldDelta >= 0 ? "+" : ""}
              {soldDelta.toFixed(0)}% vs prior
            </span>
            <span
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: revDelta >= 0 ? "#e7f3ec" : "#f8e8e6", color: revDelta >= 0 ? CHART.leaf : CHART.wine }}
            >
              Revenue {revDelta >= 0 ? "+" : ""}
              {revDelta.toFixed(0)}% vs prior
            </span>
          </div>
        </div>
        <PaceChart points={report.pace} />
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Sold", value: String(k.soldQty), spark: report.pace.map((p) => p.soldQty), color: CHART.copper, note: `${k.prevSoldQty} prior` },
          { label: "Revenue", value: formatListPrice(k.revenue), spark: report.pace.map((p) => p.revenue), color: CHART.brass, note: `${k.marginPct.toFixed(0)}% margin` },
          { label: "On the shelf", value: formatListPrice(k.onHandValue), spark: report.coverBuckets.map((b) => b.onHand), color: CHART.slate, note: `${k.onHandQty} pcs` },
          { label: "Quote close", value: `${k.closeRate.toFixed(0)}%`, spark: report.pace.map((p) => p.quotedQty), color: CHART.leaf, note: `${k.confirmedQuotes} of ${k.quotedJobs} jobs` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{stat.label}</p>
              <Spark values={stat.spark} color={stat.color} />
            </div>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.note}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-lg bg-card px-3 py-1.5 ring-1 ring-border">
          Ordered <strong className="font-mono">{k.orderedQty}</strong> · {k.openPoQty} open
        </span>
        <span className="rounded-lg bg-card px-3 py-1.5 ring-1 ring-border">
          Avg job <strong className="font-mono">{formatListPrice(k.aov)}</strong>
        </span>
        <span className="rounded-lg bg-card px-3 py-1.5 ring-1 ring-border">
          Discount <strong className="font-mono">{k.avgDiscount.toFixed(1)}%</strong>
        </span>
        <span className="rounded-lg bg-card px-3 py-1.5 ring-1 ring-border">
          Gross <strong className="font-mono">{formatListPrice(k.margin)}</strong>
        </span>
      </div>

      <BriefDesk snapshot={snapshot} />

      <Tabs defaultValue="sold">
        <TabsList variant="line" className="flex-wrap">
          <TabsTrigger value="sold">Sold</TabsTrigger>
          <TabsTrigger value="shelf">Shelf</TabsTrigger>
          <TabsTrigger value="ordered">Ordered</TabsTrigger>
          <TabsTrigger value="money">Money</TabsTrigger>
          <TabsTrigger value="demand">Demand</TabsTrigger>
        </TabsList>

        <TabsContent value="sold" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Best selling" hint="Bar length is pieces moved">
              <HBars rows={report.bestQty} value={(row) => row.qty} />
            </Panel>
            <Panel title="Quote path" hint="Interest that turned into a job">
              <Funnel quoted={k.quotedJobs} confirmed={k.confirmedQuotes} soldQty={k.soldQty} />
            </Panel>
            <Panel title="Rising / falling" hint="Green right, wine left · vs last equal window">
              <Diverging rows={[...report.risers.slice(0, 4), ...report.fallers.slice(0, 4)]} />
            </Panel>
            <Panel title="Most quoted">
              <HBars rows={report.mostQuoted} value={(row) => row.quotedCount} />
            </Panel>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Best selling · detail">
              <RankTable rows={report.bestQty} mode="sold" />
            </Panel>
            <Panel title="Highest revenue">
              <RankTable rows={report.bestRevenue} mode="money" />
            </Panel>
            <Panel title="Quoted, not sold">
              <RankTable rows={report.interestNoClose} mode="quoted" />
            </Panel>
            <Panel title="Dead in this period">
              <RankTable rows={report.dead} mode="quoted" />
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="shelf" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Stock vs sales" hint="Bubble size is shelf value. Top-left is slow money.">
              <ScatterShelf rows={report.all} />
            </Panel>
            <Panel title="Cover" hint="How long the rack lasts at this period’s pace">
              <ul className="space-y-3">
                {report.coverBuckets.map((bucket) => (
                  <li key={bucket.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{bucket.label}</span>
                      <span className="font-mono tabular-nums">
                        {bucket.skuCount} SKUs · {bucket.onHand} pcs
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(4, (bucket.skuCount / coverMax) * 100)}%`,
                          background: bucket.label === "No sales" ? CHART.wine : CHART.slate,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Most stored">
              <RankTable rows={report.mostStored} mode="stock" />
            </Panel>
            <Panel title="Slow stock">
              <RankTable rows={report.slowStock} mode="stock" />
            </Panel>
            <Panel title="Empty or spoken for">
              <RankTable rows={report.stockouts} mode="stock" />
            </Panel>
            <Panel title="Least stored">
              <RankTable rows={report.leastStored} mode="stock" />
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="ordered" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Job vs restock">
              <StackedPair aLabel="Job orders" a={report.jobQty} bLabel="Restock" b={report.restockQty} />
              <div className="mt-6">
                <HBars rows={report.mostOrdered} value={(row) => row.orderedQty} />
              </div>
            </Panel>
            <Panel title="Still inbound" hint="Ordered, not on the rack yet">
              <HBars rows={report.openPos} value={(row) => row.openPoQty} />
            </Panel>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Most ordered">
              <RankTable rows={report.mostOrdered} mode="order" />
            </Panel>
            <Panel title="Over-bought">
              <RankTable rows={report.overBuy} mode="order" />
            </Panel>
            <Panel title="Under-bought">
              <RankTable rows={report.underBuy} mode="order" />
            </Panel>
            <Panel title="Least ordered">
              <RankTable rows={report.leastOrdered} mode="order" />
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="money" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Brand mix">
              <Donut slices={report.mixBrand} title="Brands" />
            </Panel>
            <Panel title="Category mix">
              <Donut slices={report.mixCategory} title="Types" />
            </Panel>
            <Panel title="Finish mix">
              <Donut slices={report.mixFinish} title="Finish" />
            </Panel>
            <Panel title="Who bought" hint="Revenue by customer in this cut">
              <Donut slices={report.mixCustomer} title="Buyers" />
            </Panel>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Margin leaders">
              <RankTable rows={report.marginLeaders} mode="money" />
            </Panel>
            <Panel title="Lowest revenue among sellers">
              <RankTable rows={report.worstRevenue} mode="money" />
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="demand" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Repeat vs one-off">
              <StackedPair aLabel="Repeat SKUs" a={report.repeatSkus} bLabel="One-off" b={report.oneOffSkus} />
              <div className="mt-6">
                <WeekBars days={report.weekdayPace} />
              </div>
            </Panel>
            <Panel title="Sold together" hint="Same confirmed quote">
              {report.attach.length ? <AttachFlow pairs={report.attach} /> : <p className="text-sm text-muted-foreground">No pairs in this cut.</p>}
            </Panel>
          </div>
          <Panel title="When pieces move" hint="Full sample year · darker copper = more pcs">
            <HeatGrid cells={report.heatmap} months={MONTHS} days={DAYS} />
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  )
}
