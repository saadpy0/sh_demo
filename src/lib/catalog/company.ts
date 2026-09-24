import { BRAND } from "@/lib/brand"

/** Letterhead copy for printed proforma invoices. Update when final GSTIN / bank details are confirmed. */
export const COMPANY = {
  name: BRAND.legalName,
  wordmark: BRAND.wordmark,
  addressLines: ["Ambattur Industrial Estate", "Chennai, Tamil Nadu, India"],
  gstin: "GSTIN: —",
  bank: {
    accountName: BRAND.legalName,
    bankName: "—",
    accountNo: "—",
    branchIfsc: "—",
  },
} as const
