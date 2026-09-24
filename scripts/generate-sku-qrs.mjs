import { createHash } from "crypto"
import { mkdirSync, readFileSync, writeFileSync } from "fs"
import path from "path"
import QRCode from "qrcode"
import { gunzipSync } from "zlib"

const root = process.cwd()
const outDir = path.join(root, "public", "qr", "variants")
const manifestPath = path.join(root, "public", "qr", "manifest.json")

const rawSeed = JSON.parse(
  gunzipSync(readFileSync(path.join(root, "data", "catalog-seed.json.gz"))).toString()
)
const scope = JSON.parse(readFileSync(path.join(root, "data", "catalog-scope.json"), "utf8"))
const allowed = new Set(scope.catalogIds)

function filterSeed(data) {
  const catalogs = data.catalogs.filter((c) => allowed.has(c.id))
  const supplierIds = new Set(catalogs.map((c) => c.supplier_id))
  const suppliers = data.suppliers.filter((s) => supplierIds.has(s.id))
  const categories = data.categories.filter((c) => allowed.has(c.catalog_id))
  const categoryIds = new Set(categories.map((c) => c.id))
  const collections = data.collections.filter(
    (c) => allowed.has(c.catalog_id) && (c.category_id == null || categoryIds.has(c.category_id))
  )
  const collectionIds = new Set(collections.map((c) => c.id))
  const products = data.products.filter(
    (p) => allowed.has(p.catalog_id) && (p.collection_id == null || collectionIds.has(p.collection_id))
  )
  const productIds = new Set(products.map((p) => p.id))
  const product_prices = data.product_prices.filter((p) => productIds.has(p.product_id))
  return { suppliers, catalogs, categories, collections, products, product_prices }
}

const seed = filterSeed(rawSeed)

function splitFinishGroup(finish) {
  const value = (finish || "").trim()
  if (!value) return [""]
  const COLOR_WORD =
    /\b(black|gold|grey|gray|white|marble|brush|rose|ruby|blue|green|nickel|antique|olive|forest|pink|ice|matt)\b/i
  function splitSlashGroup(group) {
    const parts = group.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean)
    if (parts.length <= 1) return parts.length ? parts : [group]
    if (parts.length === 2 && (COLOR_WORD.test(parts[0]) || COLOR_WORD.test(parts[1]))) return [group.trim()]
    return parts
  }
  const commaParts = value.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean)
  const groups = commaParts.length ? commaParts : [value]
  const out = []
  const seen = new Set()
  for (const group of groups) {
    for (const token of splitSlashGroup(group)) {
      const next = token.trim()
      if (!next) continue
      const key = next.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(next)
    }
  }
  return out.length ? out : [value]
}

function splitSizeGroup(size) {
  const value = (size || "").trim()
  if (!value) return [""]
  const range = value.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(.*)$/)
  if (range) {
    const unit = range[3].trim()
    return [`${range[1]}${unit ? ` ${unit}` : ""}`.trim(), `${range[2]}${unit ? ` ${unit}` : ""}`.trim()]
  }
  const embedded = value.match(/^(.*?)(\d+)\s*\/\s*(\d+)(\s*mm)?(.*)$/i)
  if (embedded) {
    const [, pre, a, b, unit = "", post] = embedded
    return [
      `${pre}${a}${unit}${post}`.replace(/\s+/g, " ").trim(),
      `${pre}${b}${unit}${post}`.replace(/\s+/g, " ").trim(),
    ]
  }
  return [value]
}

function normalizePart(v) {
  return (v || "").trim().toUpperCase().replace(/\s+/g, " ")
}

function internalSku(ref) {
  return [ref.code.trim(), normalizePart(ref.size), normalizePart(ref.finish), normalizePart(ref.color)]
    .filter(Boolean)
    .join(" ")
}

function expandPrice(price) {
  const finishes = splitFinishGroup(price.finish)
  const useMm = Boolean(price.size_mm)
  const sizes = splitSizeGroup(useMm ? price.size_mm : price.size_inch)
  const rows = []
  for (const finish of finishes) {
    for (const size of sizes) {
      rows.push({ finish, size_mm: useMm ? size : "", size_inch: useMm ? "" : size })
    }
  }
  return rows.length ? rows : [{ finish: price.finish, size_mm: price.size_mm, size_inch: price.size_inch }]
}

const catalogById = new Map(seed.catalogs.map((c) => [c.id, c]))
const supplierById = new Map(seed.suppliers.map((s) => [s.id, s.name]))
const pricesByProduct = new Map()
for (const p of seed.product_prices) {
  const list = pricesByProduct.get(p.product_id) || []
  list.push(p)
  pricesByProduct.set(p.product_id, list)
}

const variants = []
const seen = new Set()
for (const p of seed.products) {
  const catalog = catalogById.get(p.catalog_id)
  const supplier = supplierById.get(catalog.supplier_id)
  const prices = (pricesByProduct.get(p.id) || []).flatMap(expandPrice)
  const rows = prices.length ? prices : [{ finish: "", size_mm: p.size_mm || "", size_inch: p.size_inch || "" }]
  const colors = (p.color_options || "").split("|").filter(Boolean)
  const colorList = colors.length ? colors : [""]
  for (const row of rows) {
    const size = row.size_mm || row.size_inch || p.size_mm || p.size_inch || ""
    for (const color of colorList) {
      const ref = {
        code: p.code,
        finish: row.finish,
        size: size || "",
        color: color || "",
      }
      const lineKey = internalSku(ref)
      if (seen.has(lineKey)) continue
      seen.add(lineKey)
      variants.push({
        catalogCode: p.code,
        itemName: p.item_name,
        supplier,
        finish: ref.finish,
        size: ref.size,
        color: ref.color,
        lineKey,
        payload: `SH-SKU:${lineKey}`,
      })
    }
  }
}

mkdirSync(outDir, { recursive: true })

function fileSlug(lineKey) {
  return createHash("sha1").update(lineKey).digest("hex").slice(0, 16)
}

const manifest = []
for (let i = 0; i < variants.length; i++) {
  const row = variants[i]
  const file = `${fileSlug(row.lineKey)}.png`
  const target = path.join(outDir, file)
  await QRCode.toFile(target, row.payload, { width: 256, margin: 1, errorCorrectionLevel: "M" })
  manifest.push({ ...row, file: `/qr/variants/${file}` })
  if ((i + 1) % 200 === 0) process.stdout.write(`  ${i + 1}/${variants.length}\r`)
}

writeFileSync(
  manifestPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), count: manifest.length, rows: manifest }, null, 2)
)
console.log(`\nWrote ${manifest.length} QR PNGs to public/qr/variants/`)
