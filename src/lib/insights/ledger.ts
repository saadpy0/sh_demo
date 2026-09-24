import type { CatalogProduct } from "@/lib/catalog/types"
import type { LedgerLine, RosterItem } from "./types"

const CUSTOMERS = [
  "Priya Menon",
  "Industrial Area 10",
  "Sandeep Nair",
  "Yusuf Rahman",
  "Mehra Interiors",
  "Coastal Fit-outs",
  "Ananya Rao",
  "Greenfield Homes",
]

const VENDOR_BY_BRAND: Record<string, string> = {
  Aura: "Aura Architectural Hardware",
  "Decor Pulls Mortise": "Decor Pulls Mortise Co.",
  Laksh: "Laksh Hardware Distributors",
}

const LOCATION_BY_BRAND: Record<string, string> = {
  Aura: "A-1-X",
  "Decor Pulls Mortise": "B-2-Y",
  Laksh: "C-1-Z",
}

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed: number) {
  let s = seed || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function isoDay(origin: Date, dayOffset: number, hour = 10) {
  const d = new Date(origin)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, (dayOffset * 13) % 60, 0, 0)
  return d.toISOString()
}

export function rosterFromCatalog(products: CatalogProduct[]): RosterItem[] {
  return products.map((product) => {
    const finish = product.prices[0]?.finish || ""
    const size = product.sizeMm || product.sizeInch || product.prices[0]?.sizeMm || ""
    const listPrice = product.minPrice || product.prices.find((p) => p.price)?.price || 1200
    const unitCost = Math.round(listPrice * (0.52 + (hash(product.code) % 18) / 100))
    return {
      code: product.code,
      itemName: product.itemName,
      brand: product.supplier,
      category: product.category || "",
      collection: product.collection || "",
      finish,
      size,
      listPrice,
      unitCost,
      vendor: VENDOR_BY_BRAND[product.supplier] || product.supplier,
      location: LOCATION_BY_BRAND[product.supplier] || "A-1-X",
    }
  })
}

/**
 * One year of counter activity on real catalogue codes.
 * Heat (sold a lot), shelf-sitters, and a few SKUs that never move.
 */
export function buildDemoLedger(roster: RosterItem[], now = new Date()): LedgerLine[] {
  if (!roster.length) return []
  const origin = new Date(now)
  origin.setHours(10, 0, 0, 0)
  origin.setDate(origin.getDate() - 365)
  const lines: LedgerLine[] = []
  let quoteSeq = 9000

  for (let i = 0; i < roster.length; i++) {
    const item = roster[i]
    const roll = hash(item.code) % 100
    const heat = roll < 12 ? 3 : roll < 40 ? 2 : roll < 78 ? 1 : 0
    const next = rng(hash(`${item.code}:ledger`))
    const sku = [item.code, item.finish, item.size].filter(Boolean).join(" ")
    const customer = CUSTOMERS[hash(item.code) % CUSTOMERS.length]

    const wipeShelf = heat === 3 && i % 11 === 0
    const quoteOnly = heat === 0 && roll >= 86
    const stockBase = wipeShelf
      ? 0
      : heat === 0
        ? 18 + (hash(item.code) % 40)
        : heat === 1
          ? 8 + (hash(item.code) % 16)
          : 4 + (hash(item.code) % 8)
    lines.push({
      at: isoDay(origin, 2 + (i % 20), 8),
      kind: "inward",
      quoteId: "",
      poKind: "restock",
      received: true,
      sku,
      code: item.code,
      itemName: item.itemName,
      brand: item.brand,
      category: item.category,
      collection: item.collection,
      finish: item.finish,
      size: item.size,
      customer: "",
      vendor: item.vendor,
      location: item.location,
      qty: stockBase,
      unitPrice: item.listPrice,
      unitCost: item.unitCost,
      discountPct: 0,
    })

    if (heat === 0) {
      if (quoteOnly) {
        for (let n = 0; n < 6; n++) {
          const day = 340 + n * 4
          quoteSeq += 1
          lines.push({
            at: isoDay(origin, day, 12),
            kind: "quoted",
            quoteId: `Q-${quoteSeq}`,
            poKind: "",
            received: false,
            sku,
            code: item.code,
            itemName: item.itemName,
            brand: item.brand,
            category: item.category,
            collection: item.collection,
            finish: item.finish,
            size: item.size,
            customer,
            vendor: item.vendor,
            location: item.location,
            qty: 2,
            unitPrice: item.listPrice,
            unitCost: item.unitCost,
            discountPct: 0,
          })
        }
      }
      continue
    }

    const events = heat === 3 ? 28 : heat === 2 ? 14 : 6
    for (let n = 0; n < events; n++) {
      const day = Math.floor(next() * 360)
      const month = new Date(origin.getFullYear(), origin.getMonth() + Math.floor(day / 30), 1).getMonth()
      const festive = month === 9 || month === 10 || month === 11
      const slow = month === 4 || month === 5
      if (slow && next() < 0.45) continue
      const qty = 1 + Math.floor(next() * (festive ? 4 : 2))
      const discountPct = next() < 0.18 ? 5 + Math.floor(next() * 10) : 0
      const confirmed = next() > 0.28
      quoteSeq += 1
      const quoteId = `Q-${quoteSeq}`
      const at = isoDay(origin, day, 11 + (n % 6))
      const shared: Omit<LedgerLine, "kind" | "received" | "poKind"> = {
        at,
        quoteId,
        sku,
        code: item.code,
        itemName: item.itemName,
        brand: item.brand,
        category: item.category,
        collection: item.collection,
        finish: item.finish,
        size: item.size,
        customer,
        vendor: item.vendor,
        location: item.location,
        qty,
        unitPrice: item.listPrice,
        unitCost: item.unitCost,
        discountPct,
      }
      lines.push({ ...shared, kind: "quoted", poKind: "", received: false })
      if (confirmed) {
        lines.push({ ...shared, kind: "sold", poKind: "", received: false })
        if (next() < 0.35) {
          const partner = roster[(i + 3 + n) % roster.length]
          if (partner.brand === item.brand && partner.code !== item.code) {
            const pSku = [partner.code, partner.finish, partner.size].filter(Boolean).join(" ")
            lines.push({
              ...shared,
              sku: pSku,
              code: partner.code,
              itemName: partner.itemName,
              finish: partner.finish,
              size: partner.size,
              unitPrice: partner.listPrice,
              unitCost: partner.unitCost,
              qty: 1,
              kind: "sold",
              poKind: "",
              received: false,
            })
            lines.push({
              ...shared,
              sku: pSku,
              code: partner.code,
              itemName: partner.itemName,
              finish: partner.finish,
              size: partner.size,
              unitPrice: partner.listPrice,
              unitCost: partner.unitCost,
              qty: 1,
              kind: "quoted",
              poKind: "",
              received: false,
            })
          }
        }
      }

      if (n % 4 === 0 && !wipeShelf) {
        const poDay = Math.max(0, day - 10)
        const received = day < 350
        const poKind = next() < 0.3 ? "job" : "restock"
        const poQty = qty + 2 + Math.floor(next() * 6)
        lines.push({
          ...shared,
          at: isoDay(origin, poDay, 9),
          kind: "ordered",
          quoteId: poKind === "job" ? quoteId : "",
          poKind,
          received,
          qty: poQty,
        })
        if (received) {
          lines.push({
            ...shared,
            at: isoDay(origin, poDay + 6, 8),
            kind: "inward",
            quoteId: "",
            poKind,
            received: true,
            qty: poQty,
          })
        }
      }
    }
  }

  return lines.sort((a, b) => a.at.localeCompare(b.at))
}
