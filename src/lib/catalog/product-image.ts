import ebcoImageKeys from "./ebco-image-keys.json"
import yaleImageKeys from "./yale-image-keys.json"
import hettichImageKeys from "./hettich-image-keys.json"

// Each manifest maps a product code to the filename (no extension) that
// actually holds its photo in public/catalog/<slug>/ — same path in Storage.
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

function storagePublicBase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  if (!url) return null
  return `${url}/storage/v1/object/public/catalog`
}

/** Product photos: Supabase Storage when connected, else local /catalog files. */
export function productImageUrl(supplier: string, code: string) {
  const slug = slugify(supplier)
  const stem = MANIFESTS[slug]?.[code]
  if (!stem) return null
  const file = `${slug}/${stem}.jpg`
  const remote = storagePublicBase()
  return remote ? `${remote}/${file}` : `/catalog/${file}`
}

export function productImageUrlForCode(code: string) {
  for (const supplier of ["Ebco", "Yale", "Hettich"]) {
    const url = productImageUrl(supplier, code)
    if (url) return url
  }
  return null
}
