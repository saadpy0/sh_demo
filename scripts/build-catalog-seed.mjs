import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs"
import { gzipSync } from "zlib"
import path from "path"

const ROOT = process.cwd()
const SEED_PATH = path.join(ROOT, "data", "catalog-seed.json.gz")

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

function readCsvRows(csvPath) {
  const raw = readFileSync(csvPath, "utf8")
  const table = parseCsv(raw).filter((r) => r.length > 1 || r[0] !== "")
  const header = table[0]
  return table.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])))
}

function getNote(notes, key) {
  for (const kv of notes.split(";")) {
    const idx = kv.indexOf("=")
    if (idx === -1) continue
    if (kv.slice(0, idx) === key) return kv.slice(idx + 1)
  }
  return null
}

/** Different brand extraction scripts sanitized codes into filenames differently
 *  (strip whitespace vs. replace every non [A-Za-z0-9.-] run with `_`) — try both,
 *  once here at build time, and bake the winning filename into the manifest. */
function codeCandidates(code) {
  const trimmed = code.trim()
  return [trimmed, trimmed.replace(/\s+/g, "").replace(/\//g, "_"), trimmed.replace(/[^A-Za-z0-9.-]/g, "_")]
}

/** Resolve each product code to an actual image file in public/catalog/<slug>/ by guessing. */
function buildGuessedImageMap(slug, codes) {
  const dir = path.join(ROOT, "public", "catalog", slug)
  if (!existsSync(dir)) return {}
  const stems = new Set(
    readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".jpg"))
      .map((f) => f.replace(/\.jpg$/i, ""))
  )
  const map = {}
  for (const code of codes) {
    for (const candidate of codeCandidates(code)) {
      if (stems.has(candidate)) {
        map[code] = candidate
        break
      }
    }
  }
  return map
}

/** No finer sub-line in the source data — one flat collection per category. */
function buildEbco() {
  const rows = readCsvRows(path.join(ROOT, "data", "ebco.csv"))
  const supplier = { id: 1, name: "Ebco" }
  const catalog = { id: 1, supplier_id: 1, name: "Ebco Price List" }

  const categoryNames = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  )
  const categories = categoryNames.map((name, i) => ({ id: i + 1, catalog_id: 1, name }))
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]))
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
    const categoryId = categoryIdByName.get(r.category)
    if (!categoryId) continue
    const key = `${categoryId}::${r.code}`
    let pid = productIdByKey.get(key)
    if (pid == null) {
      productId += 1
      pid = productId
      productIdByKey.set(key, pid)
      products.push({
        id: pid,
        catalog_id: 1,
        collection_id: categoryId,
        code: r.code,
        item_name: r.name,
        confidence: "high",
        review_notes: null,
        size_mm: null,
        size_inch: null,
        color_options: null,
      })
    }

    const size = r.size
    const isInch = size.includes('"')
    const noteParts = [`Unit: ${r.uom}`]
    const packOf = getNote(r.notes, "price_per_pack_of")
    if (packOf) noteParts.push(`Pack of ${packOf}`)
    const priceUnit = getNote(r.notes, "price_unit")
    if (priceUnit) noteParts.push(`Price per ${priceUnit}`)
    if (getNote(r.notes, "new_product_or_code_change")) noteParts.push("New")

    priceId += 1
    productPrices.push({
      id: priceId,
      product_id: pid,
      finish: r.finish || "Standard",
      price: r.price ? Number(r.price) : null,
      currency: "INR",
      confidence: "high",
      review_notes: noteParts.join(" · "),
      size_mm: isInch ? "" : size,
      size_inch: isInch ? size : "",
    })
  }

  return { slug: "ebco", supplier, catalog, categories, collections, products, productPrices }
}

/** Yale: already shaped as supplier,category,collection,code,item_name,finish,price,currency,page,confidence,review_notes. */
function buildYale() {
  const rows = readCsvRows(path.join(ROOT, "data", "yale.csv"))
  const supplier = { id: 1, name: "Yale" }
  const catalog = { id: 1, supplier_id: 1, name: "Yale Price List" }

  const categoryNames = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  )
  const categories = categoryNames.map((name, i) => ({ id: i + 1, catalog_id: 1, name }))
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]))

  const collections = []
  const collectionIdByName = new Map()
  for (const r of rows) {
    if (collectionIdByName.has(r.collection)) continue
    const id = collections.length + 1
    collections.push({
      id,
      catalog_id: 1,
      category_id: categoryIdByName.get(r.category) ?? null,
      name: r.collection,
    })
    collectionIdByName.set(r.collection, id)
  }

  const products = []
  const productPrices = []
  const productIdByKey = new Map()
  let productId = 0
  let priceId = 0

  for (const r of rows) {
    const collectionId = collectionIdByName.get(r.collection)
    if (!collectionId) continue
    const key = `${collectionId}::${r.code}`
    let pid = productIdByKey.get(key)
    if (pid == null) {
      productId += 1
      pid = productId
      productIdByKey.set(key, pid)
      products.push({
        id: pid,
        catalog_id: 1,
        collection_id: collectionId,
        code: r.code,
        item_name: r.item_name,
        confidence: (r.confidence || "high").toLowerCase(),
        review_notes: null,
        size_mm: null,
        size_inch: null,
        color_options: null,
      })
    }

    priceId += 1
    productPrices.push({
      id: priceId,
      product_id: pid,
      finish: r.finish || "Standard",
      price: r.price ? Number(r.price) : null,
      currency: r.currency || "INR",
      confidence: (r.confidence || "high").toLowerCase(),
      review_notes: r.review_notes || null,
      size_mm: "",
      size_inch: "",
    })
  }

  return { slug: "yale", supplier, catalog, categories, collections, products, productPrices }
}

/** Hettich: exported straight from the SreeDesigners Postgres DB (already-validated
 *  data, not re-derived here) — one row per product_prices row, product fields repeated.
 *  11 collection names legitimately repeat under a different category, so collections
 *  are keyed by (category, collection) not name alone. */
function buildHettich() {
  const rows = readCsvRows(path.join(ROOT, "data", "hettich.csv"))
  const supplier = { id: 1, name: "Hettich" }
  const catalog = { id: 1, supplier_id: 1, name: "Hettich Price List" }

  const categoryNames = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  )
  const categories = categoryNames.map((name, i) => ({ id: i + 1, catalog_id: 1, name }))
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]))

  const collections = []
  const collectionIdByKey = new Map()
  for (const r of rows) {
    const categoryId = categoryIdByName.get(r.category)
    const key = `${categoryId}::${r.collection}`
    if (collectionIdByKey.has(key)) continue
    const id = collections.length + 1
    collections.push({ id, catalog_id: 1, category_id: categoryId, name: r.collection })
    collectionIdByKey.set(key, id)
  }

  const products = []
  const productPrices = []
  const productIdByKey = new Map()
  let productId = 0
  let priceId = 0

  for (const r of rows) {
    const categoryId = categoryIdByName.get(r.category)
    const collectionId = collectionIdByKey.get(`${categoryId}::${r.collection}`)
    if (!collectionId) continue
    const key = `${collectionId}::${r.code}`
    let pid = productIdByKey.get(key)
    if (pid == null) {
      productId += 1
      pid = productId
      productIdByKey.set(key, pid)
      products.push({
        id: pid,
        catalog_id: 1,
        collection_id: collectionId,
        code: r.code,
        item_name: r.item_name,
        confidence: (r.product_confidence || "high").toLowerCase(),
        review_notes: r.product_review_notes || null,
        size_mm: r.product_size_mm || null,
        size_inch: r.product_size_inch || null,
        color_options: r.color_options || null,
      })
    }

    priceId += 1
    productPrices.push({
      id: priceId,
      product_id: pid,
      finish: r.finish || "Standard",
      price: r.price ? Number(r.price) : null,
      currency: r.currency || "INR",
      confidence: (r.price_confidence || "high").toLowerCase(),
      review_notes: r.price_review_notes || null,
      size_mm: r.price_size_mm || "",
      size_inch: r.price_size_inch || "",
    })
  }

  return { slug: "hettich", supplier, catalog, categories, collections, products, productPrices }
}

function mergeBrands(brands) {
  const combined = { suppliers: [], catalogs: [], categories: [], collections: [], products: [], product_prices: [] }
  let supplierBase = 0
  let catalogBase = 0
  let categoryBase = 0
  let collectionBase = 0
  let productBase = 0
  let priceBase = 0

  for (const brand of brands) {
    combined.suppliers.push({ id: brand.supplier.id + supplierBase, name: brand.supplier.name })
    combined.catalogs.push({
      id: brand.catalog.id + catalogBase,
      supplier_id: brand.catalog.supplier_id + supplierBase,
      name: brand.catalog.name,
    })
    for (const c of brand.categories) {
      combined.categories.push({ id: c.id + categoryBase, catalog_id: c.catalog_id + catalogBase, name: c.name })
    }
    for (const c of brand.collections) {
      combined.collections.push({
        id: c.id + collectionBase,
        catalog_id: c.catalog_id + catalogBase,
        category_id: c.category_id != null ? c.category_id + categoryBase : null,
        name: c.name,
      })
    }
    for (const p of brand.products) {
      combined.products.push({
        ...p,
        id: p.id + productBase,
        catalog_id: p.catalog_id + catalogBase,
        collection_id: p.collection_id != null ? p.collection_id + collectionBase : null,
      })
    }
    for (const pr of brand.productPrices) {
      combined.product_prices.push({ ...pr, id: pr.id + priceBase, product_id: pr.product_id + productBase })
    }

    supplierBase += 1
    catalogBase += 1
    categoryBase += brand.categories.length
    collectionBase += brand.collections.length
    productBase += brand.products.length
    priceBase += brand.productPrices.length
  }

  return combined
}

const brands = [buildEbco(), buildYale(), buildHettich()]
const seed = mergeBrands(brands)

writeFileSync(SEED_PATH, gzipSync(JSON.stringify(seed)))
for (const brand of brands) {
  console.log(
    `${brand.supplier.name}: ${brand.products.length} products, ${brand.productPrices.length} prices, ${brand.categories.length} categories`
  )
}
console.log(
  `Combined seed written → ${seed.products.length} products, ${seed.product_prices.length} prices across ${seed.suppliers.length} suppliers`
)

// Image manifests: code -> resolved filename stem (no extension).
for (const brand of brands) {
  const codes = [...new Set(brand.products.map((p) => p.code))]
  const out = path.join(ROOT, "src", "lib", "catalog", `${brand.slug}-image-keys.json`)
  let map

  if (brand.slug === "hettich") {
    const manifestPath = path.join(ROOT, "data", "hettich-image-manifest.json")
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    map = {}
    for (const entry of manifest.matched) {
      map[entry.code] = path.basename(entry.image_path).replace(/\.jpg$/i, "")
    }
  } else {
    map = buildGuessedImageMap(brand.slug, codes)
  }

  writeFileSync(out, JSON.stringify(map))
  console.log(`${brand.supplier.name} image manifest → ${Object.keys(map).length}/${codes.length} codes resolved`)
}
