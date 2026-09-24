import ebcoImageKeys from "./ebco-image-keys.json"
import yaleImageKeys from "./yale-image-keys.json"
import hettichImageKeys from "./hettich-image-keys.json"

// Each manifest maps a product code to the filename (no extension) that
// actually holds its photo in public/catalog/<slug>/ — resolved once at
// catalogue-build time in scripts/build-catalog-seed.mjs.
const MANIFESTS: Record<string, Record<string, string>> = {
  ebco: ebcoImageKeys as Record<string, string>,
  yale: yaleImageKeys as Record<string, string>,
  hettich: hettichImageKeys as Record<string, string>,
}

function slugify(supplier: string) {
  return supplier
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

/** Product photos are added with each new catalogue import. */
export function productImageUrl(supplier: string, code: string) {
  const slug = slugify(supplier)
  const stem = MANIFESTS[slug]?.[code]
  return stem ? `/catalog/${slug}/${stem}.jpg` : null
}
