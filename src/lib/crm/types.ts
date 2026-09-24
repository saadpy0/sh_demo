export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "quoted"
  | "hold"
  | "won"
  | "lost"

export type LeadSource =
  | "walk_in"
  | "whatsapp"
  | "phone"
  | "referral"
  | "site_visit"
  | "web"

export type TradeType =
  | "contractor"
  | "subcontractor"
  | "retailer"
  | "homeowner"
  | "institution"
  | "fitout"

export type ProductLine =
  | "plumbing"
  | "electrical"
  | "tools"
  | "paint"
  | "fasteners"
  | "building"
  | "hvac"
  | "safety"

export type ActivityType =
  | "note"
  | "call"
  | "whatsapp"
  | "visit"
  | "quote"
  | "stage"
  | "convert"

export type QuoteStatus = "draft" | "sent" | "revised" | "accepted" | "expired"

export type PaymentTerms = "cod" | "net_15" | "net_30" | "net_45"

export type CustomerSegment = "walk_in" | "contractor" | "retailer" | "corporate"

export type FollowUpKind = "quote_pending" | "repeat_order" | "call" | "visit" | "payment"

export type FollowUp = {
  id: string
  accountId: string | null
  leadId: string | null
  kind: FollowUpKind
  dueAt: string
  note: string
  doneAt: string | null
  createdAt: string
  authorId: string
}

export type Staff = {
  id: string
  name: string
  role: string
  photoSeed: string
}

export type NextAction = {
  kind: "call" | "whatsapp" | "visit" | "quote" | "follow_up"
  dueAt: string
  note: string
}

export type Lead = {
  id: string
  ticket: string
  company: string
  contactName: string
  contactRole: string
  phone: string
  whatsapp: string
  email: string
  city: string
  area: string
  source: LeadSource
  tradeType: TradeType
  lines: ProductLine[]
  estimatedValue: number
  stage: LeadStage
  ownerId: string
  createdAt: string
  updatedAt: string
  nextAction: NextAction | null
  brief: string
  /** Filled when an architect or interior designer brought this client. */
  architectName: string
  architectFirm: string
  architectPhone: string
  architectEmail: string
  accountId: string | null
  lostReason: string | null
}

export type Activity = {
  id: string
  leadId: string | null
  accountId: string | null
  type: ActivityType
  body: string
  at: string
  authorId: string
}

export type Quote = {
  id: string
  leadId: string
  accountId: string | null
  number: string
  amount: number
  status: QuoteStatus
  sentAt: string | null
  validUntil: string
  note: string
  catalogVoucher?: string | null
}

export type Account = {
  id: string
  name: string
  tradeType: TradeType
  segment: CustomerSegment
  contactName: string
  phone: string
  email: string
  city: string
  area: string
  address: string
  ownerId: string
  creditLimit: number
  paymentTerms: PaymentTerms
  /** GSTIN (India) — shown as tax number in the UI */
  gstin: string
  openedAt: string
  sourceLeadId: string | null
  notes: string
  architectName: string
  architectFirm: string
  architectPhone: string
  architectEmail: string
}

export type CrmSnapshot = {
  staff: Staff[]
  leads: Lead[]
  activities: Activity[]
  quotes: Quote[]
  accounts: Account[]
  followUps: FollowUp[]
}

export type NewLeadInput = {
  company: string
  contactName: string
  contactRole: string
  phone: string
  whatsapp: string
  email: string
  city: string
  area: string
  source: LeadSource
  tradeType: TradeType
  lines: ProductLine[]
  estimatedValue: number
  ownerId: string
  brief: string
  architectName: string
  architectFirm: string
  architectPhone: string
  architectEmail: string
  nextAction: NextAction | null
}
