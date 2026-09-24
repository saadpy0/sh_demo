import { inRange, periodDays } from "./period"
import type { PeriodRange } from "./types"
import type {
  AttachPair,
  CoverBucket,
  HeatCell,
  InsightFilters,
  LedgerLine,
  MixSlice,
  PacePoint,
  RankRow,
  RosterItem,
} from "./types"

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function shortDay(value: Date) {
  return `${value.getDate()} ${MONTH_SHORT[value.getMonth()]}`
}

function buildPace(
  lines: LedgerLine[],
  range: PeriodRange,
  revenueOfLine: (line: LedgerLine) => number
): PacePoint[] {
  const days = periodDays(range)
  const step = days > 45 ? 7 : 1
  const points: PacePoint[] = []
  const cursor = new Date(range.start)
  while (cursor < range.end) {
    const next = new Date(cursor)
    next.setDate(next.getDate() + step)
    const end = next > range.end ? range.end : next
    points.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
      label: shortDay(cursor),
      startMs: cursor.getTime(),
      soldQty: 0,
      revenue: 0,
      quotedQty: 0,
      orderedQty: 0,
    })
    cursor.setTime(end.getTime())
  }
  for (const line of lines) {
    if (!inRange(line.at, range.start, range.end)) continue
    const at = new Date(line.at).getTime()
    let index = 0
    for (let i = 0; i < points.length; i++) {
      const start = points[i].startMs
      const stop = i + 1 < points.length ? points[i + 1].startMs : range.end.getTime()
      if (at >= start && at < stop) {
        index = i
        break
      }
    }
    const point = points[index]
    if (!point) continue
    if (line.kind === "sold") {
      point.soldQty += line.qty
      point.revenue += revenueOfLine(line)
    } else if (line.kind === "quoted") {
      point.quotedQty += line.qty
    } else if (line.kind === "ordered") {
      point.orderedQty += line.qty
    }
  }
  return points
}

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

function matches(line: LedgerLine, filters: InsightFilters) {
  if (filters.brand && line.brand !== filters.brand) return false
  if (filters.category && line.category !== filters.category) return false
  if (filters.collection && line.collection !== filters.collection) return false
  if (filters.finish && line.finish !== filters.finish) return false
  if (filters.size && line.size !== filters.size) return false
  if (filters.vendor && line.vendor !== filters.vendor) return false
  if (filters.customer && line.customer !== filters.customer) return false
  if (filters.location && line.location !== filters.location) return false
  return true
}

function revenueOf(line: LedgerLine) {
  return line.qty * line.unitPrice * (1 - (line.discountPct || 0) / 100)
}

function costOf(line: LedgerLine) {
  return line.qty * line.unitCost
}

function blankRow(item: { code: string; itemName: string; brand: string }): RankRow {
  return {
    code: item.code,
    itemName: item.itemName,
    brand: item.brand,
    qty: 0,
    revenue: 0,
    cost: 0,
    quotedQty: 0,
    quotedCount: 0,
    soldCount: 0,
    orderedQty: 0,
    receivedQty: 0,
    jobQty: 0,
    restockQty: 0,
    openPoQty: 0,
    onHand: 0,
    onHandValue: 0,
    lastSold: null,
    lastInward: null,
    coverDays: null,
    prevQty: 0,
    prevRevenue: 0,
  }
}

function accumulate(rows: Map<string, RankRow>, line: LedgerLine, bucket: "cur" | "prev" | "stock") {
  const row = rows.get(line.code) || blankRow(line)
  if (bucket === "stock") {
    if (line.kind === "inward") {
      row.onHand += line.qty
      if (!row.lastInward || line.at > row.lastInward) row.lastInward = line.at
    }
    if (line.kind === "sold") {
      row.onHand -= line.qty
      if (!row.lastSold || line.at > row.lastSold) row.lastSold = line.at
    }
    rows.set(line.code, row)
    return
  }
  if (line.kind === "sold") {
    if (bucket === "cur") {
      row.qty += line.qty
      row.revenue += revenueOf(line)
      row.cost += costOf(line)
      row.soldCount += 1
      if (!row.lastSold || line.at > row.lastSold) row.lastSold = line.at
    } else {
      row.prevQty += line.qty
      row.prevRevenue += revenueOf(line)
    }
  }
  if (bucket === "cur" && line.kind === "quoted") {
    row.quotedQty += line.qty
    row.quotedCount += 1
  }
  if (bucket === "cur" && line.kind === "ordered") {
    row.orderedQty += line.qty
    if (line.poKind === "job") row.jobQty += line.qty
    if (line.poKind === "restock") row.restockQty += line.qty
    if (!line.received) row.openPoQty += line.qty
  }
  if (bucket === "cur" && line.kind === "inward") {
    row.receivedQty += line.qty
    if (!row.lastInward || line.at > row.lastInward) row.lastInward = line.at
  }
  rows.set(line.code, row)
}

export function uniqueOptions(lines: LedgerLine[]) {
  const pick = (key: keyof LedgerLine) =>
    [...new Set(lines.map((line) => String(line[key] || "")).filter(Boolean))].sort()
  return {
    brands: pick("brand"),
    categories: pick("category"),
    collections: pick("collection"),
    finishes: pick("finish"),
    sizes: pick("size"),
    vendors: pick("vendor"),
    customers: pick("customer"),
    locations: pick("location"),
  }
}

export function computeInsights(
  ledger: LedgerLine[],
  roster: RosterItem[],
  range: PeriodRange,
  filters: InsightFilters = emptyFilters
) {
  const scoped = ledger.filter((line) => matches(line, filters))
  const rows = new Map<string, RankRow>()
  for (const item of roster) {
    if (filters.brand && item.brand !== filters.brand) continue
    if (filters.category && item.category !== filters.category) continue
    if (filters.collection && item.collection !== filters.collection) continue
    rows.set(item.code, blankRow(item))
  }

  for (const line of scoped) {
    accumulate(rows, line, "stock")
    if (inRange(line.at, range.start, range.end)) accumulate(rows, line, "cur")
    if (inRange(line.at, range.prevStart, range.prevEnd)) accumulate(rows, line, "prev")
  }

  const days = periodDays(range)
  const list = [...rows.values()].map((row) => {
    row.onHand = Math.max(0, row.onHand)
    const cost = roster.find((item) => item.code === row.code)?.unitCost || 0
    row.onHandValue = row.onHand * cost
    row.coverDays = row.qty > 0 ? Math.round((row.onHand / (row.qty / days)) * 10) / 10 : null
    return row
  })

  const sold = list.filter((row) => row.qty > 0).sort((a, b) => b.qty - a.qty)
  const quoted = list.filter((row) => row.quotedQty > 0)
  const periodSold = scoped.filter((line) => line.kind === "sold" && inRange(line.at, range.start, range.end))
  const periodQuoted = scoped.filter((line) => line.kind === "quoted" && inRange(line.at, range.start, range.end))
  const periodOrdered = scoped.filter((line) => line.kind === "ordered" && inRange(line.at, range.start, range.end))

  const revenue = sold.reduce((sum, row) => sum + row.revenue, 0)
  const cost = sold.reduce((sum, row) => sum + row.cost, 0)
  const soldQty = sold.reduce((sum, row) => sum + row.qty, 0)
  const quoteIds = new Set(periodSold.map((line) => line.quoteId).filter(Boolean))
  const quotedIds = new Set(periodQuoted.map((line) => line.quoteId).filter(Boolean))
  const discountBase = periodSold.reduce(
    (acc, line) => {
      acc.weight += line.qty
      acc.sum += line.discountPct * line.qty
      return acc
    },
    { sum: 0, weight: 0 }
  )

  const mix = (key: keyof LedgerLine): MixSlice[] => {
    const map = new Map<string, MixSlice>()
    for (const line of periodSold) {
      const label = String(line[key] || "—")
      const cur = map.get(label) || { label, qty: 0, revenue: 0 }
      cur.qty += line.qty
      cur.revenue += revenueOf(line)
      map.set(label, cur)
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue)
  }

  const quotesById = new Map<string, Set<string>>()
  for (const line of periodSold) {
    if (!line.quoteId) continue
    const set = quotesById.get(line.quoteId) || new Set()
    set.add(line.code)
    quotesById.set(line.quoteId, set)
  }
  const pairMap = new Map<string, AttachPair>()
  for (const codes of quotesById.values()) {
    const listCodes = [...codes].sort()
    for (let i = 0; i < listCodes.length; i++) {
      for (let j = i + 1; j < listCodes.length; j++) {
        const key = `${listCodes[i]}||${listCodes[j]}`
        const cur = pairMap.get(key) || { a: listCodes[i], b: listCodes[j], count: 0 }
        cur.count += 1
        pairMap.set(key, cur)
      }
    }
  }

  const customerSku = new Map<string, number>()
  for (const line of periodSold) {
    const key = `${line.customer}||${line.code}`
    customerSku.set(key, (customerSku.get(key) || 0) + 1)
  }
  const skuRepeat = new Map<string, { repeat: number; one: number }>()
  for (const [key, count] of customerSku) {
    const code = key.split("||")[1]
    const cur = skuRepeat.get(code) || { repeat: 0, one: 0 }
    if (count > 1) cur.repeat += 1
    else cur.one += 1
    skuRepeat.set(code, cur)
  }
  let repeat = 0
  let oneOff = 0
  for (const value of skuRepeat.values()) {
    if (value.repeat > 0) repeat += 1
    else oneOff += 1
  }

  const heatMap = new Map<string, number>()
  const heatSource = scoped.filter((line) => line.kind === "sold")
  for (const line of heatSource) {
    const at = new Date(line.at)
    const key = `${at.getMonth()}-${at.getDay()}`
    heatMap.set(key, (heatMap.get(key) || 0) + line.qty)
  }
  const heatmap: HeatCell[] = []
  for (let month = 0; month < 12; month++) {
    for (let weekday = 0; weekday < 7; weekday++) {
      heatmap.push({ month, weekday, qty: heatMap.get(`${month}-${weekday}`) || 0 })
    }
  }

  const weekdayPace = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    qty: heatmap.filter((cell) => cell.weekday === weekday).reduce((sum, cell) => sum + cell.qty, 0),
  }))

  const coverBuckets: CoverBucket[] = [
    { label: "< 1 wk", skuCount: 0, onHand: 0 },
    { label: "1–4 wk", skuCount: 0, onHand: 0 },
    { label: "1–3 mo", skuCount: 0, onHand: 0 },
    { label: "3 mo+", skuCount: 0, onHand: 0 },
    { label: "No sales", skuCount: 0, onHand: 0 },
  ]
  for (const row of list) {
    if (row.onHand <= 0) continue
    const bucket =
      row.coverDays == null
        ? coverBuckets[4]
        : row.coverDays < 7
          ? coverBuckets[0]
          : row.coverDays < 28
            ? coverBuckets[1]
            : row.coverDays < 90
              ? coverBuckets[2]
              : coverBuckets[3]
    bucket.skuCount += 1
    bucket.onHand += row.onHand
  }

  const pace = buildPace(scoped, range, revenueOf)
  const jobQty = list.reduce((sum, row) => sum + row.jobQty, 0)
  const restockQty = list.reduce((sum, row) => sum + row.restockQty, 0)

  return {
    kpis: {
      soldQty,
      revenue,
      cost,
      margin: revenue - cost,
      marginPct: revenue ? ((revenue - cost) / revenue) * 100 : 0,
      onHandQty: list.reduce((sum, row) => sum + row.onHand, 0),
      onHandValue: list.reduce((sum, row) => sum + row.onHandValue, 0),
      orderedQty: list.reduce((sum, row) => sum + row.orderedQty, 0),
      openPoQty: list.reduce((sum, row) => sum + row.openPoQty, 0),
      quotes: periodQuoted.length,
      quotedJobs: quotedIds.size,
      confirmedQuotes: quoteIds.size,
      closeRate: quotedIds.size ? (quoteIds.size / quotedIds.size) * 100 : 0,
      aov: quoteIds.size ? revenue / quoteIds.size : 0,
      avgDiscount: discountBase.weight ? discountBase.sum / discountBase.weight : 0,
      prevSoldQty: list.reduce((sum, row) => sum + row.prevQty, 0),
      prevRevenue: list.reduce((sum, row) => sum + row.prevRevenue, 0),
    },
    bestQty: [...sold].slice(0, 12),
    worstQty: [...sold].sort((a, b) => a.qty - b.qty).slice(0, 12),
    bestRevenue: [...sold].sort((a, b) => b.revenue - a.revenue).slice(0, 12),
    worstRevenue: [...sold].sort((a, b) => a.revenue - b.revenue).slice(0, 12),
    mostQuoted: [...quoted].sort((a, b) => b.quotedCount - a.quotedCount).slice(0, 12),
    interestNoClose: quoted
      .filter((row) => row.quotedCount >= 3 && row.qty === 0)
      .sort((a, b) => b.quotedCount - a.quotedCount)
      .slice(0, 12),
    dead: list.filter((row) => row.qty === 0 && row.quotedQty === 0).slice(0, 16),
    risers: list
      .filter((row) => row.qty + row.prevQty > 0)
      .map((row) => ({ ...row, delta: row.qty - row.prevQty }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 10),
    fallers: list
      .filter((row) => row.qty + row.prevQty > 0)
      .map((row) => ({ ...row, delta: row.qty - row.prevQty }))
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 10),
    mostStored: [...list].sort((a, b) => b.onHandValue - a.onHandValue).slice(0, 12),
    leastStored: [...list].filter((row) => row.onHand > 0).sort((a, b) => a.onHand - b.onHand).slice(0, 12),
    slowStock: list
      .filter((row) => row.onHand >= 8 && row.qty <= 2)
      .sort((a, b) => b.onHandValue - a.onHandValue)
      .slice(0, 12),
    stockouts: list.filter((row) => row.onHand === 0 && (row.qty > 0 || row.quotedQty > 0)).slice(0, 12),
    mostOrdered: [...list].filter((row) => row.orderedQty > 0).sort((a, b) => b.orderedQty - a.orderedQty).slice(0, 12),
    leastOrdered: [...list].filter((row) => row.orderedQty > 0).sort((a, b) => a.orderedQty - b.orderedQty).slice(0, 12),
    openPos: list.filter((row) => row.openPoQty > 0).sort((a, b) => b.openPoQty - a.openPoQty).slice(0, 12),
    overBuy: list
      .filter((row) => row.orderedQty >= 6 && row.qty <= 2)
      .sort((a, b) => b.orderedQty - a.orderedQty)
      .slice(0, 12),
    underBuy: list
      .filter((row) => row.qty >= 6 && row.onHand <= 3 && row.openPoQty === 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 12),
    marginLeaders: [...sold].sort((a, b) => b.revenue - b.cost - (a.revenue - a.cost)).slice(0, 12),
    discountHeavy: periodSold.length
      ? [...sold].filter((row) => row.revenue > 0).sort((a, b) => b.qty - a.qty).slice(0, 8)
      : [],
    mixBrand: mix("brand"),
    mixCategory: mix("category"),
    mixFinish: mix("finish"),
    mixCustomer: mix("customer"),
    attach: [...pairMap.values()].sort((a, b) => b.count - a.count).slice(0, 12),
    repeatSkus: repeat,
    oneOffSkus: oneOff,
    heatmap,
    weekdayPace,
    coverBuckets,
    pace,
    jobQty,
    restockQty,
    all: list,
    periodSoldCount: periodSold.length,
    periodOrderedCount: periodOrdered.length,
  }
}

export type InsightsReport = ReturnType<typeof computeInsights>
