import ebcoImageKeys from "./ebco-image-keys.json"
import yaleImageKeys from "./yale-image-keys.json"

const MANIFESTS: Record<string, Set<string>> = {
  ebco: new Set(ebcoImageKeys as string[]),
  yale: new Set(yaleImageKeys as string[]),
}

function slugify(supplier: string) {
  return supplier
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

/** Different brand extraction scripts sanitized codes into filenames differently
 *  (strip whitespace vs. replace every non [A-Za-z0-9.-] run with `_`) — try both. */
function codeCandidates(code: string) {
  const trimmed = code.trim()
  return [trimmed, trimmed.replace(/\s+/g, "").replace(/\//g, "_"), trimmed.replace(/[^A-Za-z0-9.-]/g, "_")]
}

/** Product photos are added with each new catalogue import. */
export function productImageUrl(supplier: string, code: string) {
  const slug = slugify(supplier)
  const manifest = MANIFESTS[slug]
  if (!manifest) return null
  for (const candidate of codeCandidates(code)) {
    if (manifest.has(candidate)) return `/catalog/${slug}/${candidate}.jpg`
  }
  return null
}
