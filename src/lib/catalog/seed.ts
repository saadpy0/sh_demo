import { readFileSync } from "fs"
import { gunzipSync } from "zlib"
import path from "path"
import { DEFAULT_CURRENCY } from "@/lib/locale/india"
import { productImageUrl } from "./product-image"
import { expandCatalogPrice, splitColorGroup } from "./split-options"
import type { CatalogPrice, CatalogProduct, FilterOptions, SizeOption } from "./types"

type SeedPrice = {
  id: number
  product_id: number
  finish: string
  price: number | null
  currency: string
  confidence: string
  review_notes: string | null
  size_mm: string
  size_inch: string
}

type SeedProduct = {
  id: number
  catalog_id: number
  collection_id: number | null
  code: string
  item_name: string
  confidence: string
  review_notes: string | null
  size_mm: string | null
  size_inch: string | null
  color_options: string | null
}

export type CatalogSeed = {
  suppliers: Array<{ id: number; name: string }>
  catalogs: Array<{ id: number; supplier_id: number; name: string }>
  categories: Array<{ id: number; catalog_id: number; name: string }>
  collections: Array<{
    id: number
    catalog_id: number
    category_id: number | null
    name: string
  }>
  products: SeedProduct[]
  product_prices: SeedPrice[]
}

const EMPTY_SEED: CatalogSeed = {
  suppliers: [],
  catalogs: [],
  categories: [],
  collections: [],
  products: [],
  product_prices: [],
}

let cached: CatalogSeed | null = null

export function loadSeed(): CatalogSeed {
  if (cached) return cached
  try {
    const file = readFileSync(path.join(process.cwd(), "data", "catalog-seed.json.gz"))
    cached = JSON.parse(gunzipSync(file).toString("utf8")) as CatalogSeed
  } catch {
    cached = EMPTY_SEED
  }
  return cached
}

export function mapPrice(row: SeedPrice): CatalogPrice {
  return {
    id: row.id,
    productId: row.product_id,
    finish: row.finish,
    price: row.price,
    currency: DEFAULT_CURRENCY,
    confidence: row.confidence,
    note: row.review_notes,
    sizeMm: row.size_mm || "",
    sizeInch: row.size_inch || "",
  }
}

export function hydrateProduct(
  seed: CatalogSeed,
  product: SeedProduct,
  prices: CatalogPrice[]
): CatalogProduct {
  const catalog = seed.catalogs.find((item) => item.id === product.catalog_id)
  const supplier = catalog ? seed.suppliers.find((item) => item.id === catalog.supplier_id) : null
  const collection = product.collection_id
    ? seed.collections.find((item) => item.id === product.collection_id)
    : null
  const category = collection?.category_id
    ? seed.categories.find((item) => item.id === collection.category_id)
    : null
  const numeric = prices.map((p) => p.price).filter((p): p is number => p != null)
  return {
    id: product.id,
    catalogId: product.catalog_id,
    collectionId: product.collection_id,
    code: product.code,
    itemName: product.item_name,
    confidence: product.confidence,
    reviewNotes: product.review_notes,
    sizeMm: product.size_mm,
    sizeInch: product.size_inch,
    colors: splitColorGroup(product.color_options),
    category: category?.name ?? null,
    collection: collection?.name ?? null,
    supplier: supplier?.name ?? "",
    catalog: catalog?.name ?? "",
    imageUrl: productImageUrl(supplier?.name ?? "", product.code),
    prices: prices.flatMap(expandCatalogPrice),
    minPrice: numeric.length ? Math.min(...numeric) : null,
    maxPrice: numeric.length ? Math.max(...numeric) : null,
  }
}

export function sizeLabel(field: "size_mm" | "size_inch", value: string): SizeOption {
  const unit = field === "size_mm" ? "mm" : "inch"
  const already =
    field === "size_mm"
      ? value.toUpperCase().endsWith("MM")
      : value.includes('"')
  return {
    key: `${field}:${value}`,
    value,
    label: already ? value : `${value} ${unit}`,
  }
}

export function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  )
}

export function emptyFilters(): FilterOptions {
  return { suppliers: [], categories: [], collections: [], finishes: [], sizes: [] }
}
