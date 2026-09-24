import type {
  CustomerSegment,
  FollowUpKind,
  LeadSource,
  LeadStage,
  PaymentTerms,
  ProductLine,
  QuoteStatus,
  TradeType,
} from "./types"

export const STAGE_ORDER: LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "quoted",
  "hold",
  "won",
  "lost",
]

export const BOARD_STAGES: LeadStage[] = ["new", "contacted", "quoted", "hold", "won"]

export const STAGE_LABEL: Record<LeadStage, string> = {
  new: "New",
  contacted: "Spoken to",
  qualified: "Interested",
  quoted: "Quote sent",
  hold: "Waiting",
  won: "Quotes Won",
  lost: "Lost",
}

export const SOURCE_LABEL: Record<LeadSource, string> = {
  walk_in: "Walk-in",
  whatsapp: "WhatsApp",
  phone: "Phone",
  referral: "Referral",
  site_visit: "Site visit",
  web: "Website",
}

export const TRADE_LABEL: Record<TradeType, string> = {
  contractor: "Contractor",
  subcontractor: "Subcontractor",
  retailer: "Retailer",
  homeowner: "Homeowner",
  institution: "Institution",
  fitout: "Fit-out",
}

export const LINE_LABEL: Record<ProductLine, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  tools: "Tools",
  paint: "Paint",
  fasteners: "Fasteners",
  building: "Building materials",
  hvac: "HVAC",
  safety: "Safety",
}

export const TERMS_LABEL: Record<PaymentTerms, string> = {
  cod: "Cash on delivery",
  net_15: "15 days",
  net_30: "30 days",
  net_45: "45 days",
}

export const CITIES = [
  "Chennai",
  "Mumbai",
  "Bengaluru",
  "Delhi",
  "Hyderabad",
  "Coimbatore",
  "Kochi",
  "Pune",
] as const


export const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  walk_in: "Walk-in",
  contractor: "Contractor",
  retailer: "Retailer",
  corporate: "Company",
}

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  revised: "Updated",
  accepted: "Sold",
  expired: "Expired",
}

export const FOLLOW_UP_LABEL: Record<FollowUpKind, string> = {
  quote_pending: "Need to send quote",
  repeat_order: "Usual reorder",
  call: "Call back",
  visit: "Visit",
  payment: "Payment reminder",
}

export function segmentFromTrade(trade: TradeType): CustomerSegment {
  if (trade === "retailer") return "retailer"
  if (trade === "institution") return "corporate"
  if (trade === "homeowner") return "walk_in"
  return "contractor"
}

export function architectLabel(name: string, firm: string) {
  const who = [name.trim(), firm.trim()].filter(Boolean)
  return who.length ? who.join(" · ") : ""
}

/** Why a board move is blocked. Empty string means allowed. */
export function stageMoveBlock(
  from: LeadStage,
  to: LeadStage,
  hasQuote: boolean
): string {
  if (from === to) return "Already here"
  if (from === "won") return "This enquiry is closed."
  if (to === "won") return "Close the enquiry from the enquiry page."
  if (to === "quoted" && !hasQuote) return "Save a quote first — then it moves here on its own."
  if (to === "hold" && !hasQuote) return "Save a quote first."
  if (from === "lost" && (to === "quoted" || to === "hold") && !hasQuote) {
    return "Save a quote first."
  }
  if ((from === "quoted" || from === "hold") && (to === "new" || to === "contacted" || to === "qualified")) {
    return "This already has a quote."
  }
  return ""
}

export function isOpenEnquiry(stage: LeadStage) {
  return stage !== "lost" && stage !== "won"
}

export function isCompletedProject(stage: LeadStage) {
  return stage === "won"
}
