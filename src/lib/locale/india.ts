/** Site-wide defaults for India operations. */
export const DEFAULT_CURRENCY = "INR" as const

const UAE_CITY_TO_INDIA: Record<string, string> = {
  sharjah: "Chennai",
  dubai: "Mumbai",
  "abu dhabi": "Bengaluru",
  ajman: "Coimbatore",
  "ras al khaimah": "Kochi",
  fujairah: "Hyderabad",
  "umm al quwain": "Pune",
  alain: "Chennai",
  "al ain": "Chennai",
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}

function formatMobileTen(ten: string) {
  if (ten.length !== 10) return ten
  return `+91 ${ten.slice(0, 2)} ${ten.slice(2, 5)} ${ten.slice(5)}`
}

function formatLandlineTen(ten: string, std = "44") {
  if (ten.length !== 10) return `+91 ${std} ${ten}`
  return `+91 ${std} ${ten.slice(0, 3)} ${ten.slice(3, 7)}`
}

/** True when the string looks like UAE / legacy Gulf dialing. */
export function isGulfPhone(value: string) {
  const d = digitsOnly(value)
  if (!d) return false
  if (d.startsWith("971")) return true
  if (d.startsWith("05") && d.length === 10) return true
  if (d.startsWith("04") && d.length === 9) return true
  if (d.startsWith("02") && d.length === 9) return true
  return false
}

/** Map Gulf numbers to a stable +91 display; pass-through when already Indian. */
export function normalizeIndianPhone(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed

  const d = digitsOnly(trimmed)

  if (d.startsWith("91") && d.length >= 12) {
    const local = d.slice(2)
    const ten = local.length > 10 ? local.slice(-10) : local
    if (ten.length === 10 && /^[6-9]/.test(ten)) return formatMobileTen(ten)
    if (ten.length === 10) return formatLandlineTen(ten, ten.slice(0, 2))
    return trimmed
  }

  if (d.startsWith("971")) {
    const local = d.slice(3)
    if (local.startsWith("5") && local.length >= 9) {
      const nine = local.slice(0, 9)
      const ten = `9${nine.slice(0, 9)}`.slice(0, 10)
      return formatMobileTen(ten)
    }
    if (local.startsWith("4") && local.length >= 7) {
      const rest = local.slice(1).padEnd(7, "0").slice(0, 7)
      return `+91 44 ${rest.slice(0, 3)} ${rest.slice(3, 7)}`
    }
    const fallback = `9${local}`.replace(/\D/g, "").slice(-10)
    if (fallback.length === 10) return formatMobileTen(fallback)
  }

  if (d.startsWith("05") && d.length === 10) {
    const nine = d.slice(1)
    return formatMobileTen(`9${nine.slice(0, 9)}`)
  }

  if (d.startsWith("04") && d.length === 9) {
    const rest = d.slice(1)
    return `+91 44 ${rest.slice(0, 3)} ${rest.slice(3, 7)}`
  }

  if (d.length === 10 && /^[6-9]/.test(d)) {
    return formatMobileTen(d)
  }

  return trimmed
}

export function normalizeIndianCity(city: string): string {
  const key = city.trim().toLowerCase()
  if (!key) return city
  return UAE_CITY_TO_INDIA[key] ?? city
}

export function normalizeCurrency(currency: string | null | undefined): typeof DEFAULT_CURRENCY {
  if (!currency || currency.toUpperCase() === DEFAULT_CURRENCY) return DEFAULT_CURRENCY
  return DEFAULT_CURRENCY
}
