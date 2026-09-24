import { readFileSync, writeFileSync, readdirSync } from "fs"
import { gzipSync } from "zlib"
import path from "path"

const ROOT = process.cwd()
const CSV_PATH = path.join(ROOT, "data", "ebco.csv")
const SEED_PATH = path.join(ROOT, "data", "catalog-seed.json.gz")
const IMAGE_DIR = path.join(ROOT, "public", "catalog", "ebco")
const IMAGE_KEYS_PATH = path.join(ROOT, "src", "lib", "catalog", "ebco-image-keys.json")

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else if (c === "\r") {
      // skip
    } else field += c
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function getNote(notes, key) {
  for (const kv of notes.split(";")) {
    const idx = kv.indexOf("=")
    if (idx === -1) continue
    if (kv.slice(0, idx) === key) return kv.slice(idx + 1)
  }
  return null
}

const raw = readFileSync(CSV_PATH, "utf8")
const table = parseCsv(raw).filter((r) => r.length > 1 || r[0] !== "")
const header = table[0]
const rows = table.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])))

const SUPPLIER = { id: 1, name: "Ebco" }
const CATALOG = { id: 1, supplier_id: 1, name: "Ebco Price List" }

const categoryNames = [...new Set(rows.map((r) => r.category.trim()).filter(Boolean))].sort((a, b) =>
  a.localeCompare(b)
)
const categories = categoryNames.map((name, i) => ({ id: i + 1, catalog_id: 1, name }))
const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]))

// No finer sub-line in the source data — one flat collection per category.
const collections = categories.map((c) => ({
  id: c.id,
  catalog_id: 1,
  category_id: c.id,
  name: c.name,
}))

const products = []
const productPrices = []
const productIdByKey = new Map()
let productId = 0
let priceId = 0

for (const r of rows) {
  const categoryName = r.category.trim()
  const categoryId = categoryIdByName.get(categoryName)
  if (!categoryId) continue
  const code = r.code.trim()
  const key = `${categoryId}::${code}`
  let pid = productIdByKey.get(key)
  if (pid == null) {
    productId += 1
    pid = productId
    productIdByKey.set(key, pid)
    products.push({
      id: pid,
      catalog_id: 1,
      collection_id: categoryId,
      code,
      item_name: r.name.trim(),
      confidence: "high",
      review_notes: null,
      size_mm: null,
      size_inch: null,
      color_options: null,
    })
  }

  const size = r.size.trim()
  const isInch = size.includes('"')

  const noteParts = [`Unit: ${r.uom.trim()}`]
  const packOf = getNote(r.notes, "price_per_pack_of")
  if (packOf) noteParts.push(`Pack of ${packOf}`)
  const priceUnit = getNote(r.notes, "price_unit")
  if (priceUnit) noteParts.push(`Price per ${priceUnit}`)
  if (getNote(r.notes, "new_product_or_code_change")) noteParts.push("New")

  priceId += 1
  productPrices.push({
    id: priceId,
    product_id: pid,
    finish: r.finish.trim() || "Standard",
    price: r.price.trim() ? Number(r.price) : null,
    currency: "INR",
    confidence: "high",
    review_notes: noteParts.join(" · "),
    size_mm: isInch ? "" : size,
    size_inch: isInch ? size : "",
  })
}

const seed = {
  suppliers: [SUPPLIER],
  catalogs: [CATALOG],
  categories,
  collections,
  products,
  product_prices: productPrices,
}

writeFileSync(SEED_PATH, gzipSync(JSON.stringify(seed)))
console.log(
  `Seed written → ${products.length} products, ${productPrices.length} prices, ${categories.length} categories`
)

const imageFiles = readdirSync(IMAGE_DIR).filter((f) => f.toLowerCase().endsWith(".jpg"))
const imageKeys = imageFiles.map((f) => f.replace(/\.jpg$/i, ""))
writeFileSync(IMAGE_KEYS_PATH, JSON.stringify(imageKeys))
console.log(`Image manifest written → ${imageKeys.length} images`)
