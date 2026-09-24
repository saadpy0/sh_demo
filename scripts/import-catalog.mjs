import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { gunzipSync } from "zlib"
import path from "path"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.")
  process.exit(1)
}

const seedPath = path.join(process.cwd(), "data", "catalog-seed.json.gz")
const scope = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "catalog-scope.json"), "utf8")
)
const allowedCatalogIds = new Set(scope.catalogIds)
let seed = JSON.parse(gunzipSync(readFileSync(seedPath)).toString("utf8"))
{
  const catalogs = seed.catalogs.filter((c) => allowedCatalogIds.has(c.id))
  const supplierIds = new Set(catalogs.map((c) => c.supplier_id))
  const suppliers = seed.suppliers.filter((s) => supplierIds.has(s.id))
  const categories = seed.categories.filter((c) => allowedCatalogIds.has(c.catalog_id))
  const categoryIds = new Set(categories.map((c) => c.id))
  const collections = seed.collections.filter(
    (c) =>
      allowedCatalogIds.has(c.catalog_id) && (c.category_id == null || categoryIds.has(c.category_id))
  )
  const collectionIds = new Set(collections.map((c) => c.id))
  const products = seed.products.filter(
    (p) =>
      allowedCatalogIds.has(p.catalog_id) &&
      (p.collection_id == null || collectionIds.has(p.collection_id))
  )
  const productIds = new Set(products.map((p) => p.id))
  const product_prices = seed.product_prices.filter((p) => productIds.has(p.product_id))
  seed = { suppliers, catalogs, categories, collections, products, product_prices }
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function insertAll(table, rows, chunk = 400) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk)
    const { error } = await supabase.from(table).upsert(part)
    if (error) throw new Error(`${table}: ${error.message}`)
    process.stdout.write(`  ${table} ${Math.min(i + part.length, rows.length)}/${rows.length}\r`)
  }
  console.log(`  ${table} ${rows.length}/${rows.length}`)
}

const searchByProduct = new Map()
for (const p of seed.product_prices) {
  const list = searchByProduct.get(p.product_id) || []
  list.push(p.finish, p.size_mm, p.size_inch)
  searchByProduct.set(p.product_id, list)
}
const catalogById = new Map(seed.catalogs.map((c) => [c.id, c]))
const supplierById = new Map(seed.suppliers.map((s) => [s.id, s]))
const collectionById = new Map(seed.collections.map((c) => [c.id, c]))
const categoryById = new Map(seed.categories.map((c) => [c.id, c]))

const products = seed.products.map((p) => {
  const catalog = catalogById.get(p.catalog_id)
  const supplier = supplierById.get(catalog.supplier_id)
  const collection = p.collection_id ? collectionById.get(p.collection_id) : null
  const category = collection?.category_id ? categoryById.get(collection.category_id) : null
  const extra = searchByProduct.get(p.id) || []
  return {
    ...p,
    search_text: [supplier?.name, category?.name, collection?.name, p.code, p.item_name, p.size_mm, p.size_inch, p.review_notes, ...extra]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }
})

console.log("Importing catalog seed into Supabase…")
await insertAll("suppliers", seed.suppliers)
await insertAll("catalogs", seed.catalogs)
await insertAll("categories", seed.categories)
await insertAll("collections", seed.collections)
await insertAll("products", products)
await insertAll("product_prices", seed.product_prices)
console.log("Done.")
