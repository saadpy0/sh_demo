import type { CatalogPrice } from "./types"

/** Words that mark a two-tone finish name (keep BLACK/GOLD MATT as one option). */
const COLOR_WORD =
  /\b(black|gold|grey|gray|white|marble|brush|rose|ruby|blue|green|nickel|antique|olive|forest|pink|ice|matt)\b/i

function isCodeToken(token: string) {
  const parts = token
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.length) return false
  return parts.every((part) => {
    const compact = part.replace(/[^A-Za-z0-9]/g, "")
    if (!compact || compact.length > 6) return false
    if (COLOR_WORD.test(part) && compact.length > 4) return false
    return /^[A-Za-z0-9][A-Za-z0-9.\- ]{0,10}$/.test(part)
  })
}

function isDualTonePair(parts: string[]) {
  if (parts.length !== 2) return false
  return COLOR_WORD.test(parts[0]) || COLOR_WORD.test(parts[1])
}

function withSharedPrefix(parts: string[]) {
  const firstWords = parts[0].split(/\s+/).filter(Boolean)
  if (firstWords.length < 2) return parts
  const last = firstWords[firstWords.length - 1]
  if (!isCodeToken(last)) return parts
  if (!parts.slice(1).every(isCodeToken)) return parts
  const prefix = firstWords.slice(0, -1).join(" ")
  return parts.map((part, index) => (index === 0 ? part : `${prefix} ${part}`))
}

function splitSlashGroup(group: string) {
  const parts = group
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length <= 1) return parts.length ? parts : [group]
  if (isDualTonePair(parts)) return [group.trim()]
  return withSharedPrefix(parts)
}

/** Split a catalogue price-group into individual finishes. Dual-tone names stay intact. */
export function splitFinishGroup(finish: string) {
  const value = (finish || "").trim()
  if (!value) return [""]
  const commaParts = value
    .split(/\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
  const groups = commaParts.length ? commaParts : [value]
  const out: string[] = []
  const seen = new Set<string>()
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

/** Split grouped sizes such as `300 / 450 MM` or `CY 60/70mm`. */
export function splitSizeGroup(size: string | null | undefined) {
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

export function splitColorGroup(raw: string | null | undefined) {
  if (!raw?.trim()) return []
  const chunks = raw.includes("|") ? raw.split("|") : [raw]
  const out: string[] = []
  const seen = new Set<string>()
  for (const chunk of chunks) {
    for (const token of splitFinishGroup(chunk)) {
      const next = token.trim()
      if (!next) continue
      const key = next.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(next)
    }
  }
  return out
}

export function expandCatalogPrice(price: CatalogPrice): CatalogPrice[] {
  const finishes = splitFinishGroup(price.finish)
  const useMm = Boolean(price.sizeMm)
  const sizes = splitSizeGroup(useMm ? price.sizeMm : price.sizeInch)
  const rows: CatalogPrice[] = []
  let offset = 0
  for (const finish of finishes) {
    for (const size of sizes) {
      rows.push({
        ...price,
        id: price.id * 100 + offset,
        finish,
        sizeMm: useMm ? size : "",
        sizeInch: useMm ? "" : size,
      })
      offset += 1
    }
  }
  return rows.length ? rows : [price]
}
