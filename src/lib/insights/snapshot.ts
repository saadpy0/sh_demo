import type { InsightsReport } from "./compute"
import type { InsightFilters, RankRow } from "./types"

function slim(
  rows: Array<RankRow & { delta?: number }>,
  n = 6
): Array<Record<string, string | number | null>> {
  return rows.slice(0, n).map((row) => ({
    code: row.code,
    name: row.itemName,
    brand: row.brand,
    sold: row.qty,
    revenue: Math.round(row.revenue),
    quoted: row.quotedCount,
    onHand: row.onHand,
    ordered: row.orderedQty,
    openPo: row.openPoQty,
    coverDays: row.coverDays,
    delta: row.delta ?? row.qty - row.prevQty,
  }))
}

function mix(slices: InsightsReport["mixBrand"], n = 5) {
  return slices.slice(0, n).map((slice) => ({
    label: slice.label,
    qty: slice.qty,
    revenue: Math.round(slice.revenue),
  }))
}

export function compactInsights(
  report: InsightsReport,
  period: string,
  filters: InsightFilters
) {
  const k = report.kpis
  return {
    period,
    filters: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    kpis: {
      soldQty: k.soldQty,
      prevSoldQty: k.prevSoldQty,
      revenue: Math.round(k.revenue),
      prevRevenue: Math.round(k.prevRevenue),
      marginPct: Math.round(k.marginPct),
      onHandQty: k.onHandQty,
      onHandValue: Math.round(k.onHandValue),
      orderedQty: k.orderedQty,
      openPoQty: k.openPoQty,
      quoteClosePct: Math.round(k.closeRate),
      quotedJobs: k.quotedJobs,
      confirmedJobs: k.confirmedQuotes,
      aov: Math.round(k.aov),
      avgDiscountPct: Math.round(k.avgDiscount * 10) / 10,
    },
    jobQty: report.jobQty,
    restockQty: report.restockQty,
    repeatSkus: report.repeatSkus,
    oneOffSkus: report.oneOffSkus,
    bestQty: slim(report.bestQty),
    worstQty: slim(report.worstQty),
    bestRevenue: slim(report.bestRevenue),
    mostQuoted: slim(report.mostQuoted),
    quotedNotSold: slim(report.interestNoClose),
    dead: slim(report.dead),
    risers: slim(report.risers),
    fallers: slim(report.fallers),
    slowStock: slim(report.slowStock),
    stockouts: slim(report.stockouts),
    mostStored: slim(report.mostStored),
    mostOrdered: slim(report.mostOrdered),
    overBuy: slim(report.overBuy),
    underBuy: slim(report.underBuy),
    mixBrand: mix(report.mixBrand),
    mixCategory: mix(report.mixCategory),
    mixFinish: mix(report.mixFinish),
    mixCustomer: mix(report.mixCustomer),
    attach: report.attach.slice(0, 6),
    cover: report.coverBuckets,
  }
}

export type InsightSnapshot = ReturnType<typeof compactInsights>
