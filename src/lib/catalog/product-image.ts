import ebcoImageKeys from "./ebco-image-keys.json"

const MANIFESTS: Record<string, Set<string>> = {
  ebco: new Set(ebcoImageKeys as string[]),
}

function slugify(supplier: string) {
  return supplier
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function normalizeCode(code: string) {
  return code.replace(/\s+/g, "").replace(/\//g, "_")
}

/** Product photos are added with each new catalogue import. */
export function productImageUrl(supplier: string, code: string) {
  const slug = slugify(supplier)
  const manifest = MANIFESTS[slug]
  if (!manifest) return null
  const key = normalizeCode(code)
  if (!manifest.has(key)) return null
  return `/catalog/${slug}/${key}.jpg`
}
