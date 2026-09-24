"use client"

export type LibraryScanHint = {
  query: string
  finish?: string
  size?: string
  color?: string
}

function fromUrl(raw: string): LibraryScanHint | null {
  try {
    const url = new URL(raw)
    const q =
      url.searchParams.get("q") ||
      url.searchParams.get("code") ||
      url.searchParams.get("sku") ||
      url.searchParams.get("product")
    if (q?.trim()) return { query: q.trim() }
  } catch {
    return null
  }
  return null
}

/** Map a scanned QR, URL, or typed code to a catalogue search. */
export async function resolveLibraryScan(raw: string): Promise<LibraryScanHint> {
  const text = raw.trim()
  if (!text) throw new Error("Nothing on that label")
  if (/^BTH-LOC:/i.test(text)) throw new Error("That is a bin label. Scan a product QR.")

  const fromLink = fromUrl(text)
  if (fromLink) return fromLink

  const skuTagged = text.match(/^BTH-SKU:(.+)$/i)
  if (skuTagged?.[1]?.trim()) return { query: skuTagged[1].trim() }

  if (/^BTH-/i.test(text) && !/^BTH-LOC:/i.test(text)) {
    return { query: text.replace(/^BTH-/i, "") }
  }

  return { query: text }
}
