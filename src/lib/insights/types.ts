export type PeriodKey = "7d" | "30d" | "month" | "last_month" | "quarter" | "year" | "custom"

export type PeriodRange = {
  key: PeriodKey
  label: string
  start: Date
  end: Date
  prevStart: Date
  prevEnd: Date
}

export type InsightFilters = {
  brand: string
  category: string
  collection: string
  finish: string
  size: string
  vendor: string
  customer: string
  location: string
}

export type RosterItem = {
  code: string
  itemName: string
  brand: string
  category: string
  collection: string
  finish: string
  size: string
  listPrice: number
  unitCost: number
  vendor: string
  location: string
}

export type LedgerKind = "quoted" | "sold" | "inward" | "ordered"

export type LedgerLine = {
  at: string
  kind: LedgerKind
  quoteId: string
  poKind: "job" | "restock" | ""
  received: boolean
  sku: string
  code: string
  itemName: string
  brand: string
  category: string
  collection: string
  finish: string
  size: string
  customer: string
  vendor: string
  location: string
  qty: number
  unitPrice: number
  unitCost: number
  discountPct: number
}

export type RankRow = {
  code: string
  itemName: string
  brand: string
  qty: number
  revenue: number
  cost: number
  quotedQty: number
  quotedCount: number
  soldCount: number
  orderedQty: number
  receivedQty: number
  jobQty: number
  restockQty: number
  openPoQty: number
  onHand: number
  onHandValue: number
  lastSold: string | null
  lastInward: string | null
  coverDays: number | null
  prevQty: number
  prevRevenue: number
}

export type MixSlice = {
  label: string
  qty: number
  revenue: number
}

export type AttachPair = {
  a: string
  b: string
  count: number
}

export type HeatCell = {
  month: number
  weekday: number
  qty: number
}

export type PacePoint = {
  key: string
  label: string
  startMs: number
  soldQty: number
  revenue: number
  quotedQty: number
  orderedQty: number
}

export type CoverBucket = {
  label: string
  skuCount: number
  onHand: number
}

export type WatchItem = {
  code: string
  why: string
  do: string
}

export type ShopBrief = {
  headline: string
  points: string[]
  watch: WatchItem[]
  buy: string
  leave: string
}
