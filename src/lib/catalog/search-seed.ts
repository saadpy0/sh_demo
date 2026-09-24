import {
  emptyFilters,
  hydrateProduct,
  loadSeed,
  mapPrice,
  sizeLabel,
  uniqueSorted,
} from "./seed"
import { splitFinishGroup, splitSizeGroup } from "./split-options"
import type { CatalogProduct, FilterOptions, SearchParams, SearchResult } from "./types"

function tokens(q: string) {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}"]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 1)
}

function haystack(product: CatalogProduct) {
  return [
    product.supplier,
    product.catalog,
    product.category,
    product.collection,
    product.code,
    product.itemName,
    product.sizeMm,
    product.sizeInch,
    product.reviewNotes,
    ...product.prices.map((p) => `${p.finish} ${p.sizeMm} ${p.sizeInch}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function matchesSize(product: CatalogProduct, sizeKey: string) {
  const [field, ...rest] = sizeKey.split(":")
  const value = rest.join(":").trim().toUpperCase()
  if ((field !== "size_mm" && field !== "size_inch") || !value) return true
  const productVal = (field === "size_mm" ? product.sizeMm : product.sizeInch) || ""
  if (splitSizeGroup(productVal).some((item) => item.toUpperCase() === value)) return true
  return product.prices.some((p) => {
    const rowVal = field === "size_mm" ? p.sizeMm : p.sizeInch
    return splitSizeGroup(rowVal).some((item) => item.toUpperCase() === value)
  })
}

export function searchSeed(params: SearchParams): SearchResult {
  const seed = loadSeed()
  const q = params.q?.trim() ?? ""
  const needles = tokens(q)
  const brands = (params.brands || []).map((b) => b.toLowerCase())
  const category = params.category?.trim().toLowerCase()
  const collection = params.collection?.trim().toLowerCase()
  const finish = params.finish?.trim().toLowerCase()
  const size = params.size?.trim()
  const limit = params.limit ?? 40
  const offset = params.offset ?? 0

  const pricesByProduct = new Map<number, ReturnType<typeof mapPrice>[]>()
  for (const row of seed.product_prices) {
    const list = pricesByProduct.get(row.product_id) || []
    list.push(mapPrice(row))
    pricesByProduct.set(row.product_id, list)
  }

  const matched: CatalogProduct[] = []
  for (const row of seed.products) {
    const product = hydrateProduct(seed, row, pricesByProduct.get(row.id) || [])
    if (brands.length && !brands.includes(product.supplier.toLowerCase())) continue
    if (category && (product.category || "").toLowerCase() !== category) continue
    if (collection && (product.collection || "").toLowerCase() !== collection) continue
    if (finish && !product.prices.some((p) => splitFinishGroup(p.finish).some((item) => item.toLowerCase() === finish))) continue
    if (size && !matchesSize(product, size)) continue
    if (needles.length) {
      const hay = haystack(product)
      if (!needles.every((token) => hay.includes(token))) continue
    }
    matched.push(product)
  }

  return {
    total: matched.length,
    results: matched.slice(offset, offset + limit),
    query: q,
    source: "seed",
  }
}

export function filtersSeed(params: {
  brands?: string[]
  category?: string
  collection?: string
}): FilterOptions {
  const seed = loadSeed()
  const brands = (params.brands || []).map((b) => b.toLowerCase())
  const category = params.category?.trim().toLowerCase()
  const collection = params.collection?.trim().toLowerCase()

  const supplierById = new Map(seed.suppliers.map((s) => [s.id, s.name]))
  const catalogBrand = new Map(
    seed.catalogs.map((c) => [c.id, supplierById.get(c.supplier_id) || ""])
  )
  const allowedCatalogs = new Set(
    seed.catalogs
      .filter((c) => !brands.length || brands.includes((catalogBrand.get(c.id) || "").toLowerCase()))
      .map((c) => c.id)
  )

  const categories = seed.categories.filter((c) => allowedCatalogs.has(c.catalog_id))
  const categoryNames = uniqueSorted(categories.map((c) => c.name))
  const categoryIds = new Set(
    categories
      .filter((c) => !category || c.name.toLowerCase() === category)
      .map((c) => c.id)
  )

  const collections = seed.collections.filter((c) => {
    if (!allowedCatalogs.has(c.catalog_id)) return false
    if (category && c.category_id && !categoryIds.has(c.category_id)) return false
    return true
  })
  const collectionNames = uniqueSorted(collections.map((c) => c.name))
  const collectionIds = new Set(
    collections
      .filter((c) => !collection || c.name.toLowerCase() === collection)
      .map((c) => c.id)
  )

  const productIds = new Set(
    seed.products
      .filter((p) => allowedCatalogs.has(p.catalog_id))
      .filter((p) => !collection || (p.collection_id && collectionIds.has(p.collection_id)))
      .map((p) => p.id)
  )

  const prices = seed.product_prices.filter((p) => productIds.has(p.product_id))
  const finishes = uniqueSorted(prices.flatMap((p) => splitFinishGroup(p.finish)))
  const sizeMap = new Map<string, ReturnType<typeof sizeLabel>>()
  for (const p of seed.products.filter((item) => productIds.has(item.id))) {
    for (const size of splitSizeGroup(p.size_mm)) {
      if (size) sizeMap.set(`size_mm:${size}`, sizeLabel("size_mm", size))
    }
    for (const size of splitSizeGroup(p.size_inch)) {
      if (size) sizeMap.set(`size_inch:${size}`, sizeLabel("size_inch", size))
    }
  }
  for (const p of prices) {
    for (const size of splitSizeGroup(p.size_mm)) {
      if (size) sizeMap.set(`size_mm:${size}`, sizeLabel("size_mm", size))
    }
    for (const size of splitSizeGroup(p.size_inch)) {
      if (size) sizeMap.set(`size_inch:${size}`, sizeLabel("size_inch", size))
    }
  }

  return {
    suppliers: uniqueSorted(seed.suppliers.map((s) => s.name)),
    categories: categoryNames,
    collections: collectionNames,
    finishes,
    sizes: [...sizeMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
  }
}

export function productSeed(id: number) {
  const seed = loadSeed()
  const row = seed.products.find((p) => p.id === id)
  if (!row) return null
  const prices = seed.product_prices.filter((p) => p.product_id === id).map(mapPrice)
  return hydrateProduct(seed, row, prices)
}

export function suppliersSeed() {
  return uniqueSorted(loadSeed().suppliers.map((s) => s.name))
}

export { emptyFilters }
