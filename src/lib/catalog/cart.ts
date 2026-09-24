"use client"

import { readLocalStorageItem } from "@/lib/brand"
import type { CartItem } from "@/lib/catalog/types"

const KEY = "shw-cart-v2"
const LEAD_KEY = "shw-quote-lead-v1"
const LEGACY_KEYS = ["bth-cart-v2"] as const
const LEGACY_LEAD_KEYS = ["bth-quote-lead-v1"] as const
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((fn) => fn())
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(readLocalStorageItem(KEY, LEGACY_KEYS) || "[]") as CartItem[]
  } catch {
    return []
  }
}

export function writeCart(items: CartItem[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items))
  emit()
}

export function addToCart(item: CartItem) {
  const items = readCart()
  const existing = items.findIndex(
    (row) =>
      row.productId === item.productId &&
      row.finish === item.finish &&
      row.exactFinish === item.exactFinish &&
      row.size === item.size &&
      row.color === item.color
  )
  if (existing >= 0) {
    items[existing] = {
      ...items[existing],
      quantity: items[existing].quantity + item.quantity,
    }
  } else {
    items.push(item)
  }
  writeCart(items)
}

export function subscribeCart(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function cartCount() {
  return readCart().reduce((sum, item) => sum + item.quantity, 0)
}

export function readQuoteLeadId(): string {
  if (typeof window === "undefined") return ""
  try {
    return readLocalStorageItem(LEAD_KEY, LEGACY_LEAD_KEYS) || ""
  } catch {
    return ""
  }
}

function writeQuoteLeadId(leadId: string) {
  if (leadId) window.localStorage.setItem(LEAD_KEY, leadId)
  else window.localStorage.removeItem(LEAD_KEY)
  emit()
}

/** Bind the catalogue cart to this enquiry. Switching customer clears leftover lines. */
export function beginQuoteForLead(leadId: string) {
  const previous = readQuoteLeadId()
  if (previous && previous !== leadId && readCart().length) writeCart([])
  writeQuoteLeadId(leadId)
}

/** Catalogue browse only — cart stays, no customer attached. */
export function clearQuoteLead() {
  if (!readQuoteLeadId()) return
  writeQuoteLeadId("")
}
