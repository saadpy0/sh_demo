/** No catalog rows loaded yet — update when new catalogues are imported. */
export const ALLOWED_CATALOG_IDS = [] as const

export const ACTIVE_SUPPLIER_NAMES = [] as const

type SeedShape = {
  suppliers: Array<{ id: number; name: string }>
  catalogs: Array<{ id: number; supplier_id: number; name: string }>
  categories: Array<{ id: number; catalog_id: number; name: string }>
  collections: Array<{ id: number; catalog_id: number; category_id: number | null; name: string }>
  products: Array<{ id: number; catalog_id: number; collection_id: number | null }>
  product_prices: Array<{ product_id: number }>
}

export function filterCatalogSeed<T extends SeedShape>(seed: T): T {
  return seed
}
