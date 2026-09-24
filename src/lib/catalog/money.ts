import { DEFAULT_CURRENCY } from "@/lib/locale/india"
import type { CartItem } from "./types"

/** Always formats as Indian Rupees (INR); stored currency on line items is normalized separately. */
export function formatListPrice(value: number | null, _currency?: string) {
  if (value == null) return "Ask"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: DEFAULT_CURRENCY,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

export function lineAmount(item: CartItem) {
  if (item.unitPrice == null) return null
  return roundMoney(
    item.quantity *
      item.unitPrice *
      (1 - (item.discountPct || 0) / 100) *
      (1 + (item.gstPct || 0) / 100)
  )
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export { splitFinishGroup as splitFinishOptions } from "./split-options"
