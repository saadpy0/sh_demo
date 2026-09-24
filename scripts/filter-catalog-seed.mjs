import { readFileSync, writeFileSync } from "fs"
import { gunzipSync, gzipSync } from "zlib"
import path from "path"

const root = process.cwd()
const scope = JSON.parse(readFileSync(path.join(root, "data", "catalog-scope.json"), "utf8"))
const allowed = new Set(scope.catalogIds)

const seedPath = path.join(root, "data", "catalog-seed.json.gz")
const seed = JSON.parse(gunzipSync(readFileSync(seedPath)).toString("utf8"))

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
  (p) => allowed.has(p.catalog_id) && (p.collection_id == null || collectionIds.has(p.collection_id))
)
const productIds = new Set(products.map((p) => p.id))
const product_prices = seed.product_prices.filter((p) => productIds.has(p.product_id))

const filtered = { suppliers, catalogs, categories, collections, products, product_prices }
writeFileSync(seedPath, gzipSync(JSON.stringify(filtered)))

console.log(
  `Filtered seed → ${products.length} products, ${catalogs.length} catalogues, ${suppliers.length} suppliers`
)
