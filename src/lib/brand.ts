/** Singapore Hardwares — shared display naming and storage keys. */

export const BRAND = {
  name: "Singapore Hardwares",
  legalName: "SINGAPORE HARDWARES",
  wordmark: "Singapore Hardwares",
  monogram: "SHW",
  slug: "singapore-hardwares",
  contactEmail: "projects@singaporehardwares.in",
} as const

export const LS_UI_MODE_KEY = "shw-ui-mode"
export const LS_UI_MODE_LEGACY = "bth-ui-mode"

export const FLOOR_PHONE_ID = "shw-floor-phone"
export const FLOOR_PHONE_ID_LEGACY = "bth-floor-phone"

/** Read primary localStorage key, migrating from legacy keys when found. */
export function readLocalStorageItem(primary: string, legacy: readonly string[]): string | null {
  if (typeof window === "undefined") return null
  try {
    for (const key of [primary, ...legacy]) {
      const value = window.localStorage.getItem(key)
      if (value == null) continue
      if (key !== primary) {
        window.localStorage.setItem(primary, value)
        window.localStorage.removeItem(key)
      }
      return value
    }
  } catch {
    /* ignore */
  }
  return null
}
