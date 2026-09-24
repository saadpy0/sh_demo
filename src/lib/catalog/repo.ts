import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { filtersSeed, productSeed, searchSeed, suppliersSeed } from "./search-seed"
import { productImageUrl } from "./product-image"
import { sizeLabel, uniqueSorted } from "./seed"
import { expandCatalogPrice, splitColorGroup, splitFinishGroup, splitSizeGroup } from "./split-options"
import type {
  CatalogPrice,
  CatalogProduct,
  FilterOptions,
  Quotation,
  QuotationInput,
  QuotationSummary,
  SearchParams,
  SearchResult,
} from "./types"
import { lineAmount, roundMoney } from "./money"
import { DEFAULT_CURRENCY, normalizeCurrency, normalizeIndianPhone } from "@/lib/locale/india"
import { ACTIVE_SUPPLIER_NAMES, ALLOWED_CATALOG_IDS } from "./scope"

function supabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export function catalogSource() {
  return supabase() ? "supabase" : "seed"
}

function toProduct(
  row: Record<string, unknown>,
  prices: CatalogPrice[],
  extras: { supplier: string; catalog: string; category: string | null; collection: string | null }
): CatalogProduct {
  const numeric = prices.map((p) => p.price).filter((p): p is number => p != null)
  return {
    id: row.id as number,
    catalogId: row.catalog_id as number,
    collectionId: (row.collection_id as number | null) ?? null,
    code: row.code as string,
    itemName: row.item_name as string,
    confidence: row.confidence as string,
    reviewNotes: (row.review_notes as string | null) ?? null,
    sizeMm: (row.size_mm as string | null) ?? null,
    sizeInch: (row.size_inch as string | null) ?? null,
    colors: splitColorGroup(String(row.color_options || "")),
    category: extras.category,
    collection: extras.collection,
    supplier: extras.supplier,
    catalog: extras.catalog,
    imageUrl: productImageUrl(extras.supplier, row.code as string),
    prices: prices.flatMap(expandCatalogPrice),
    minPrice: numeric.length ? Math.min(...numeric) : null,
    maxPrice: numeric.length ? Math.max(...numeric) : null,
  }
}

async function mapRows(client: SupabaseClient, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return [] as CatalogProduct[]
  const ids = rows.map((r) => r.id as number)
  const { data: priceRows } = await client
    .from("product_prices")
    .select("id, product_id, finish, price, currency, confidence, review_notes, size_mm, size_inch")
    .in("product_id", ids)
  const byProduct = new Map<number, CatalogPrice[]>()
  for (const p of priceRows || []) {
    const list = byProduct.get(p.product_id) || []
    list.push({
      id: p.id,
      productId: p.product_id,
      finish: p.finish,
      price: p.price == null ? null : Number(p.price),
      currency: normalizeCurrency(p.currency),
      confidence: p.confidence,
      note: p.review_notes,
      sizeMm: p.size_mm || "",
      sizeInch: p.size_inch || "",
    })
    byProduct.set(p.product_id, list)
  }
  return rows.map((row) => {
    const collection = row.collections as { name: string; categories: { name: string } | null } | null
    const catalog = row.catalogs as { name: string; suppliers: { name: string } }
    return toProduct(row, byProduct.get(row.id as number) || [], {
      supplier: catalog.suppliers.name,
      catalog: catalog.name,
      category: collection?.categories?.name ?? null,
      collection: collection?.name ?? null,
    })
  })
}

export async function searchCatalog(params: SearchParams): Promise<SearchResult> {
  const client = supabase()
  if (!client) return searchSeed(params)

  const q = params.q?.trim() ?? ""
  if (!ALLOWED_CATALOG_IDS.length) {
    return { total: 0, results: [], query: q, source: "supabase" }
  }
  const limit = params.limit ?? 40
  const offset = params.offset ?? 0
  let query = client.from("products").select(
    `
      id, catalog_id, collection_id, code, item_name, confidence, review_notes,
      size_mm, size_inch, color_options,
      catalogs!inner ( name, suppliers!inner ( name ) ),
      collections ( name, categories ( name ) )
    `,
    { count: "exact" }
  )
  query = query.in("catalog_id", [...ALLOWED_CATALOG_IDS])

  if (q) {
    for (const token of q.split(/\s+/).filter(Boolean)) {
      const safe = token.replace(/[%_,]/g, "")
      if (safe) query = query.ilike("search_text", `%${safe}%`)
    }
  }
  if (params.brands?.length) {
    query = query.in("catalogs.suppliers.name", params.brands)
  }
  if (params.category) {
    query = query.eq("collections.categories.name", params.category)
  }
  if (params.collection) {
    query = query.eq("collections.name", params.collection)
  }

  const { data, error, count } = await query
    .order("code")
    .range(offset, offset + limit - 1)
  if (error) throw error

  let products = await mapRows(client, (data || []) as Array<Record<string, unknown>>)
  if (params.finish) {
    const needle = params.finish.toLowerCase()
    products = products.filter((p) =>
      p.prices.some((price) => splitFinishGroup(price.finish).some((item) => item.toLowerCase() === needle))
    )
  }
  if (params.size) {
    const [field, ...rest] = params.size.split(":")
    const value = rest.join(":").toUpperCase()
    products = products.filter((p) => {
      const own = field === "size_mm" ? p.sizeMm : p.sizeInch
      if (splitSizeGroup(own).some((item) => item.toUpperCase() === value)) return true
      return p.prices.some((price) => {
        const row = field === "size_mm" ? price.sizeMm : price.sizeInch
        return splitSizeGroup(row).some((item) => item.toUpperCase() === value)
      })
    })
  }

  return {
    total: count ?? products.length,
    results: products,
    query: q,
    source: "supabase",
  }
}

export async function catalogFilters(params: {
  brands?: string[]
  category?: string
  collection?: string
}): Promise<FilterOptions> {
  const client = supabase()
  if (!client) return filtersSeed(params)

  if (!ALLOWED_CATALOG_IDS.length) {
    return { suppliers: [], categories: [], collections: [], finishes: [], sizes: [] }
  }

  const suppliers = [...ACTIVE_SUPPLIER_NAMES]

  let catQuery = client
    .from("categories")
    .select("name, catalogs!inner(suppliers!inner(name))")
    .in("catalog_id", [...ALLOWED_CATALOG_IDS])
  if (params.brands?.length) catQuery = catQuery.in("catalogs.suppliers.name", params.brands)
  const { data: catRows } = await catQuery
  const categories = uniqueSorted((catRows || []).map((r) => r.name as string))

  let colQuery = client
    .from("collections")
    .select("name, catalogs!inner(suppliers!inner(name)), categories(name)")
    .in("catalog_id", [...ALLOWED_CATALOG_IDS])
  if (params.brands?.length) colQuery = colQuery.in("catalogs.suppliers.name", params.brands)
  if (params.category) colQuery = colQuery.eq("categories.name", params.category)
  const { data: colRows } = await colQuery
  const collections = uniqueSorted((colRows || []).map((r) => r.name as string))

  let priceQuery = client
    .from("product_prices")
    .select(
      "finish, size_mm, size_inch, products!inner(catalog_id, size_mm, size_inch, collections(name, categories(name), catalogs!inner(suppliers!inner(name))))"
    )
    .in("products.catalog_id", [...ALLOWED_CATALOG_IDS])
  if (params.brands?.length) {
    priceQuery = priceQuery.in("products.collections.catalogs.suppliers.name", params.brands)
  }
  const { data: priceRows } = await priceQuery.limit(8000)
  const finishes = uniqueSorted((priceRows || []).flatMap((r) => splitFinishGroup(r.finish as string)))
  const sizeMap = new Map<string, ReturnType<typeof sizeLabel>>()
  for (const row of priceRows || []) {
    const product = row.products as { size_mm?: string; size_inch?: string } | null
    for (const size of splitSizeGroup(row.size_mm as string)) {
      if (size) sizeMap.set(`size_mm:${size}`, sizeLabel("size_mm", size))
    }
    for (const size of splitSizeGroup(row.size_inch as string)) {
      if (size) sizeMap.set(`size_inch:${size}`, sizeLabel("size_inch", size))
    }
    for (const size of splitSizeGroup(product?.size_mm)) {
      if (size) sizeMap.set(`size_mm:${size}`, sizeLabel("size_mm", size))
    }
    for (const size of splitSizeGroup(product?.size_inch)) {
      if (size) sizeMap.set(`size_inch:${size}`, sizeLabel("size_inch", size))
    }
  }

  return {
    suppliers,
    categories,
    collections,
    finishes,
    sizes: [...sizeMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
  }
}

export async function getProduct(id: number) {
  const client = supabase()
  if (!client) return productSeed(id)
  const { data, error } = await client
    .from("products")
    .select(
      `
      id, catalog_id, collection_id, code, item_name, confidence, review_notes,
      size_mm, size_inch, color_options,
      catalogs!inner ( name, suppliers!inner ( name ) ),
      collections ( name, categories ( name ) )
    `
    )
    .eq("id", id)
    .in("catalog_id", [...ALLOWED_CATALOG_IDS])
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const [product] = await mapRows(client, [data as Record<string, unknown>])
  return product
}

export async function listSuppliers() {
  const client = supabase()
  if (!client) return suppliersSeed()
  return [...ACTIVE_SUPPLIER_NAMES]
}

function normalizeQuotationParty(contact: string) {
  return normalizeIndianPhone(contact)
}

function shapeQuote(
  header: Record<string, unknown>,
  items: Array<Record<string, unknown>>
): Quotation {
  const packaging = Number(header.packaging_forwarding || 0)
  const mapped = items.map((item) => ({
    productId: (item.product_id as number | null) ?? null,
    code: item.code as string,
    itemName: item.item_name as string,
    collection: (item.collection as string | null) ?? null,
    finish: item.finish as string,
    exactFinish: (item.exact_finish as string | null) ?? null,
    size: (item.size as string | null) ?? null,
    color: (item.color as string | null) ?? null,
    hsnSac: (item.hsn_sac as string | null) ?? null,
    unitPrice: Number(item.unit_price),
    currency: normalizeCurrency(item.currency as string),
    quantity: Number(item.quantity),
    discountPct: Number(item.discount_pct),
    gstPct: Number(item.gst_pct),
    lineAmount: Number(item.line_amount),
  }))
  return {
    id: header.id as number,
    voucherNo: header.voucher_no as string,
    quotationDate: String(header.quotation_date),
    hideDiscount: Boolean(header.hide_discount),
    packagingForwarding: packaging,
    shipTo: {
      name: header.ship_to_name as string,
      address: (header.ship_to_address as string) || "",
      contact: normalizeQuotationParty(String(header.ship_to_contact || "")),
      email: (header.ship_to_email as string) || "",
    },
    billTo: {
      name: header.bill_to_name as string,
      address: (header.bill_to_address as string) || "",
      contact: normalizeQuotationParty(String(header.bill_to_contact || "")),
      email: (header.bill_to_email as string) || "",
    },
    items: mapped,
    grandTotal: roundMoney(mapped.reduce((sum, item) => sum + item.lineAmount, 0) + packaging),
  }
}

export async function nextVoucher() {
  const client = supabase()
  if (!client) {
    const local = readLocalQuotes()
    const last = local.at(-1)?.voucherNo
    if (!last) return "BTH-1001"
    const n = Number(last.replace(/\D/g, "")) + 1
    return `BTH-${n}`
  }
  const { data } = await client
    .from("quotations")
    .select("voucher_no")
    .order("id", { ascending: false })
    .limit(1)
  const last = data?.[0]?.voucher_no as string | undefined
  if (!last) return "BTH-1001"
  const digits = last.match(/(\d+)$/)?.[1] || "1000"
  return `${last.slice(0, last.length - digits.length)}${String(Number(digits) + 1).padStart(digits.length, "0")}`
}

function summaryFromQuote(quote: Quotation): QuotationSummary {
  return {
    id: quote.id,
    voucherNo: quote.voucherNo,
    quotationDate: quote.quotationDate,
    shipToName: quote.shipTo.name,
    billToName: quote.billTo.name,
    grandTotal: quote.grandTotal,
  }
}

export async function listQuotationSummaries(limit: number, offset: number) {
  const client = supabase()
  if (!client) {
    const all = readLocalQuotes().slice().reverse()
    const slice = all.slice(offset, offset + limit).map(summaryFromQuote)
    return { results: slice, hasMore: offset + limit < all.length }
  }

  const { data, error } = await client
    .from("quotations")
    .select("id, voucher_no, quotation_date, ship_to_name, bill_to_name, packaging_forwarding")
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  const headers = data || []
  if (!headers.length) return { results: [], hasMore: false }

  const ids = headers.map((row) => row.id as number)
  const { data: items, error: itemError } = await client
    .from("quotation_items")
    .select("quotation_id, line_amount")
    .in("quotation_id", ids)
  if (itemError) throw itemError

  const lineTotals = new Map<number, number>()
  for (const item of items || []) {
    const id = item.quotation_id as number
    lineTotals.set(id, (lineTotals.get(id) || 0) + Number(item.line_amount))
  }

  const results: QuotationSummary[] = headers.map((row) => {
    const packaging = Number(row.packaging_forwarding) || 0
    const lines = lineTotals.get(row.id as number) || 0
    return {
      id: row.id as number,
      voucherNo: row.voucher_no as string,
      quotationDate: String(row.quotation_date),
      shipToName: row.ship_to_name as string,
      billToName: row.bill_to_name as string,
      grandTotal: roundMoney(lines + packaging),
    }
  })

  return { results, hasMore: headers.length === limit }
}

export async function listQuotations() {
  const client = supabase()
  if (!client) return readLocalQuotes().slice().reverse()
  const { data, error } = await client
    .from("quotations")
    .select("*")
    .order("id", { ascending: false })
    .limit(80)
  if (error) throw error
  const ids = (data || []).map((row) => row.id)
  if (!ids.length) return []
  const { data: items } = await client.from("quotation_items").select("*").in("quotation_id", ids)
  const byQuote = new Map<number, Array<Record<string, unknown>>>()
  for (const item of items || []) {
    const list = byQuote.get(item.quotation_id) || []
    list.push(item)
    byQuote.set(item.quotation_id, list)
  }
  return (data || []).map((row) => shapeQuote(row, byQuote.get(row.id) || []))
}

export async function getQuotation(id: number) {
  const client = supabase()
  if (!client) return readLocalQuotes().find((q) => q.id === id) ?? null
  const { data, error } = await client.from("quotations").select("*").eq("id", id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: items } = await client.from("quotation_items").select("*").eq("quotation_id", id)
  return shapeQuote(data, items || [])
}

export async function getQuotationByVoucher(voucherNo: string) {
  const needle = voucherNo.trim()
  if (!needle) return null
  const client = supabase()
  if (!client) {
    return (
      readLocalQuotes().find((q) => q.voucherNo.toLowerCase() === needle.toLowerCase()) ?? null
    )
  }
  const { data, error } = await client
    .from("quotations")
    .select("*")
    .eq("voucher_no", needle)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: items } = await client.from("quotation_items").select("*").eq("quotation_id", data.id)
  return shapeQuote(data, items || [])
}

export async function createQuotation(input: QuotationInput): Promise<Quotation> {
  const items = input.items.map((item) => {
    if (item.unitPrice == null) {
      throw new Error(`Price required for ${item.code}`)
    }
    const amount = lineAmount({ ...item, unitPrice: item.unitPrice })
    return {
      product_id: item.productId,
      code: item.code,
      item_name: item.itemName,
      collection: item.collection,
      finish: item.finish,
      exact_finish: item.exactFinish || item.finish,
      size: item.size,
      color: item.color,
      hsn_sac: null,
      unit_price: item.unitPrice,
      currency: DEFAULT_CURRENCY,
      quantity: item.quantity,
      discount_pct: item.discountPct,
      gst_pct: item.gstPct,
      line_amount: amount ?? 0,
    }
  })

  const shipTo = {
    ...input.shipTo,
    contact: normalizeQuotationParty(input.shipTo.contact),
  }
  const billTo = {
    ...input.billTo,
    contact: normalizeQuotationParty(input.billTo.contact),
  }

  const client = supabase()
  if (!client) {
    const local = readLocalQuotes()
    const quote: Quotation = {
      id: (local.at(-1)?.id || 0) + 1,
      voucherNo: input.voucherNo,
      quotationDate: new Date().toISOString().slice(0, 10),
      hideDiscount: input.hideDiscount,
      packagingForwarding: input.packagingForwarding,
      shipTo,
      billTo,
      items: items.map((item) => ({
        productId: item.product_id,
        code: item.code,
        itemName: item.item_name,
        collection: item.collection,
        finish: item.finish,
        exactFinish: item.exact_finish,
        size: item.size,
        color: item.color,
        hsnSac: item.hsn_sac,
        unitPrice: item.unit_price,
        currency: item.currency,
        quantity: item.quantity,
        discountPct: item.discount_pct,
        gstPct: item.gst_pct,
        lineAmount: item.line_amount,
      })),
      grandTotal: roundMoney(
        items.reduce((sum, item) => sum + item.line_amount, 0) + input.packagingForwarding
      ),
    }
    writeLocalQuotes([...local, quote])
    return quote
  }

  const { data: header, error } = await client
    .from("quotations")
    .insert({
      voucher_no: input.voucherNo,
      ship_to_name: shipTo.name,
      ship_to_address: shipTo.address,
      ship_to_contact: shipTo.contact,
      ship_to_email: shipTo.email,
      bill_to_name: billTo.name,
      bill_to_address: billTo.address,
      bill_to_contact: billTo.contact,
      bill_to_email: billTo.email,
      hide_discount: input.hideDiscount,
      packaging_forwarding: input.packagingForwarding,
    })
    .select("*")
    .single()
  if (error) throw error
  const withQuote = items.map((item) => ({ ...item, quotation_id: header.id }))
  const { error: itemError, data: stored } = await client
    .from("quotation_items")
    .insert(withQuote)
    .select("*")
  if (itemError) throw itemError
  return shapeQuote(header, stored || [])
}

function localDir() {
  if (process.env.VERCEL) return "/tmp/bth-data"
  return `${process.cwd()}/.data`
}

function localPath() {
  return `${localDir()}/quotations.json`
}

let memoryQuotes: Quotation[] | null = null

function normalizeStoredQuotation(q: Quotation): Quotation {
  return {
    ...q,
    shipTo: { ...q.shipTo, contact: normalizeQuotationParty(q.shipTo.contact) },
    billTo: { ...q.billTo, contact: normalizeQuotationParty(q.billTo.contact) },
    items: q.items.map((item) => ({ ...item, currency: normalizeCurrency(item.currency) })),
  }
}

function readLocalQuotes(): Quotation[] {
  if (memoryQuotes) return memoryQuotes.map(normalizeStoredQuotation)
  try {
    const { readFileSync } = require("fs") as typeof import("fs")
    const raw = JSON.parse(readFileSync(localPath(), "utf8")) as Quotation[]
    memoryQuotes = raw.map(normalizeStoredQuotation)
    return memoryQuotes
  } catch {
    memoryQuotes = []
    return []
  }
}

function writeLocalQuotes(quotes: Quotation[]) {
  memoryQuotes = quotes
  try {
    const fs = require("fs") as typeof import("fs")
    const path = require("path") as typeof import("path")
    const file = localPath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(quotes, null, 2))
  } catch {
    /* serverless demo: keep quotes in memory for this instance */
  }
}
