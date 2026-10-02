/** Catalog rows in data/catalog-seed.json.gz (Ebco, Yale, Hettich, Jaquar). */
export const ALLOWED_CATALOG_IDS = [1, 2, 3, 4] as const

export const ACTIVE_SUPPLIER_NAMES = ["Ebco", "Yale", "Hettich", "Jaquar"] as const

type SeedShape = {
  suppliers: Array<{ id: number; name: string }>
  catalogs: Array<{ id: number; supplier_id: number; name: string }>
  categories: Array<{ id: number; catalog_id: number; name: string }>
  collections: Array<{ id: number; catalog_id: number; category_id: number | null; name: string }>
  products: Array<{ id: number; catalog_id: number; collection_id: number | null }>
  product_prices: Array<{ product_id: number }>
}

export function filterCatalogSeed<T extends SeedShape>(seed: T): T {
  const allowed = new Set<number>(ALLOWED_CATALOG_IDS)
  const catalogs = seed.catalogs.filter((c) => allowed.has(c.id))
  const supplierIds = new Set(catalogs.map((c) => c.supplier_id))
  const suppliers = seed.suppliers.filter((s) => supplierIds.has(s.id))
  const categories = seed.categories.filter((c) => allowed.has(c.catalog_id))
  const categoryIds = new Set(categories.map((c) => c.id))
  const collections = seed.collections.filter(
    (c) => allowed.has(c.catalog_id) && (c.category_id == null || categoryIds.has(c.category_id))
  )
  const collectionIds = new Set(collections.map((c) => c.id))
  const products = seed.products.filter(
    (p) =>
      allowed.has(p.catalog_id) &&
      (p.collection_id == null || collectionIds.has(p.collection_id))
  )
  const productIds = new Set(products.map((p) => p.id))
  const product_prices = seed.product_prices.filter((p) => productIds.has(p.product_id))
  return { suppliers, catalogs, categories, collections, products, product_prices } as T
}
