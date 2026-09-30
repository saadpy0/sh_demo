"use client"

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { normalizeIndianCity, normalizeIndianPhone } from "@/lib/locale/india"
import { nextAccountId, nextQuoteNumber, nextTicket } from "./format"
import { segmentFromTrade, stageMoveBlock } from "./labels"
import { EMPTY_CRM } from "./seed"
import type {
  Account,
  Activity,
  CrmSnapshot,
  Lead,
  LeadStage,
  NewLeadInput,
  PaymentTerms,
  FollowUp,
  FollowUpKind,
  CustomerSegment,
  Quote,
} from "./types"

const KEY = "shw-crm-v6"
const BOOK_GEN_KEY = "shw-book-gen"
const BOOK_GEN = "3"

const DEMO_LEAD_IDS = new Set([
  "ld-01",
  "ld-02",
  "ld-03",
  "ld-04",
  "ld-05",
  "ld-06",
  "ld-07",
  "ld-08",
  "ld-09",
  "ld-10",
  "ld-11",
  "ld-12",
])
const DEMO_ACCOUNT_IDS = new Set([
  "ac-01",
  "ac-02",
  "ac-03",
  "ac-04",
  "ac-05",
  "ac-06",
  "ac-07",
  "ac-08",
])
const DEMO_QUOTE_IDS = new Set(["qt-01", "qt-02", "qt-03", "qt-04"])
const DEMO_FOLLOW_UP_IDS = new Set(["fu-01", "fu-02", "fu-03"])

function wipeBrowserCrm() {
  if (typeof window === "undefined") return
  const drop: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key) continue
    if (
      /^(shw-crm|bth-crm|shw-cart|bth-cart|shw-quote-lead|bth-quote-lead)/.test(key)
    ) {
      drop.push(key)
    }
  }
  drop.forEach((key) => window.localStorage.removeItem(key))
}

function stripDemo(parsed: CrmSnapshot): CrmSnapshot {
  const leads = (parsed.leads || []).filter((lead) => !DEMO_LEAD_IDS.has(lead.id))
  const leadIds = new Set(leads.map((lead) => lead.id))
  const accounts = (parsed.accounts || []).filter(
    (account) => !DEMO_ACCOUNT_IDS.has(account.id) && (!account.sourceLeadId || leadIds.has(account.sourceLeadId))
  )
  const accountIds = new Set(accounts.map((account) => account.id))
  return {
    ...parsed,
    staff: EMPTY_CRM.staff,
    leads,
    accounts,
    quotes: (parsed.quotes || []).filter(
      (quote) =>
        !DEMO_QUOTE_IDS.has(quote.id) &&
        leadIds.has(quote.leadId) &&
        (!quote.accountId || accountIds.has(quote.accountId))
    ),
    activities: (parsed.activities || []).filter(
      (activity) =>
        (!activity.leadId || leadIds.has(activity.leadId)) &&
        (!activity.accountId || accountIds.has(activity.accountId))
    ),
    followUps: (parsed.followUps || []).filter(
      (item) =>
        !DEMO_FOLLOW_UP_IDS.has(item.id) &&
        (!item.leadId || leadIds.has(item.leadId)) &&
        (!item.accountId || accountIds.has(item.accountId))
    ),
  }
}

function migrate(parsed: CrmSnapshot): CrmSnapshot {
  const leads = (parsed.leads || []).map((lead) => ({
    ...lead,
    architectName: lead.architectName || "",
    architectFirm: lead.architectFirm || "",
    architectPhone: lead.architectPhone
      ? normalizeIndianPhone(lead.architectPhone)
      : "",
    architectEmail: lead.architectEmail || "",
    phone: normalizeIndianPhone(lead.phone),
    whatsapp: normalizeIndianPhone(lead.whatsapp || lead.phone),
    city: normalizeIndianCity(lead.city),
    stage: lead.stage === "qualified" ? ("contacted" as const) : lead.stage,
  }))
  const accounts = (parsed.accounts || []).map((account) => {
    const anyAccount = account as Account & { trn?: string }
    const source = leads.find((l) => l.id === account.sourceLeadId)
    return {
      ...account,
      segment: account.segment || segmentFromTrade(account.tradeType),
      address: account.address || `${account.area}, ${account.city}`,
      gstin: account.gstin || anyAccount.trn || "",
      phone: normalizeIndianPhone(account.phone),
      city: normalizeIndianCity(account.city),
      architectName: account.architectName || source?.architectName || "",
      architectFirm: account.architectFirm || source?.architectFirm || "",
      architectPhone: account.architectPhone
        ? normalizeIndianPhone(account.architectPhone)
        : source?.architectPhone || "",
      architectEmail: account.architectEmail || source?.architectEmail || "",
    }
  })
  const quotes = (parsed.quotes || []).map((quote) => ({
    ...quote,
    accountId: quote.accountId ?? parsed.leads.find((l) => l.id === quote.leadId)?.accountId ?? null,
  }))
  return {
    ...parsed,
    leads,
    accounts,
    quotes,
    followUps: parsed.followUps || [],
  }
}

function load(): CrmSnapshot {
  if (typeof window === "undefined") return EMPTY_CRM
  try {
    if (window.localStorage.getItem(BOOK_GEN_KEY) !== BOOK_GEN) {
      wipeBrowserCrm()
      window.localStorage.setItem(BOOK_GEN_KEY, BOOK_GEN)
      return EMPTY_CRM
    }
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return EMPTY_CRM
    const parsed = JSON.parse(raw) as CrmSnapshot
    const migrated = stripDemo(
      migrate({
        ...EMPTY_CRM,
        ...parsed,
        staff: EMPTY_CRM.staff,
        leads: parsed.leads || [],
        activities: parsed.activities || [],
        quotes: parsed.quotes || [],
        accounts: parsed.accounts || [],
        followUps: parsed.followUps || [],
      })
    )
    window.localStorage.setItem(KEY, JSON.stringify(migrated))
    return migrated
  } catch {
    return EMPTY_CRM
  }
}

let snapshot: CrmSnapshot = EMPTY_CRM
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((fn) => fn())
}

function persist(next: CrmSnapshot) {
  snapshot = stripDemo(next)
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot))
  }
  emit()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSnapshot() {
  return snapshot
}

export function matchLeadByParty(name: string) {
  const needle = name.trim().toLowerCase()
  if (!needle) return null
  return (
    snapshot.leads.find((lead) => lead.company.toLowerCase() === needle) ||
    snapshot.leads.find(
      (lead) =>
        lead.company.toLowerCase().includes(needle) || needle.includes(lead.company.toLowerCase())
    ) ||
    null
  )
}

export function matchAccountByParty(name: string) {
  const needle = name.trim().toLowerCase()
  if (!needle) return null
  return (
    snapshot.accounts.find((account) => account.name.toLowerCase() === needle) ||
    snapshot.accounts.find(
      (account) =>
        account.name.toLowerCase().includes(needle) || needle.includes(account.name.toLowerCase())
    ) ||
    null
  )
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function now() {
  return new Date().toISOString()
}

export type ConvertInput = {
  creditLimit: number
  paymentTerms: PaymentTerms
  gstin: string
  address?: string
  segment?: CustomerSegment
}

export function createLead(input: NewLeadInput) {
  const ticket = nextTicket(snapshot.leads.map((l) => l.ticket))
  const phone = normalizeIndianPhone(input.phone)
  const lead: Lead = {
    id: uid("ld"),
    ticket,
    ...input,
    phone,
    whatsapp: normalizeIndianPhone(input.whatsapp || phone),
    city: normalizeIndianCity(input.city),
    architectPhone: input.architectPhone
      ? normalizeIndianPhone(input.architectPhone)
      : input.architectPhone,
    stage: "new",
    createdAt: now(),
    updatedAt: now(),
    accountId: null,
    lostReason: null,
  }
  const activity: Activity = {
    id: uid("act"),
    leadId: lead.id,
    accountId: null,
    type: "note",
    body: `Enquiry ${ticket} saved.`,
    at: now(),
    authorId: input.ownerId,
  }
  persist({
    ...snapshot,
    leads: [lead, ...snapshot.leads],
    activities: [activity, ...snapshot.activities],
  })
  return lead
}

export function updateLead(id: string, patch: Partial<Lead>) {
  const normalized = { ...patch }
  if (normalized.phone) normalized.phone = normalizeIndianPhone(normalized.phone)
  if (normalized.whatsapp) normalized.whatsapp = normalizeIndianPhone(normalized.whatsapp)
  if (normalized.architectPhone)
    normalized.architectPhone = normalizeIndianPhone(normalized.architectPhone)
  if (normalized.city) normalized.city = normalizeIndianCity(normalized.city)
  persist({
    ...snapshot,
    leads: snapshot.leads.map((lead) =>
      lead.id === id ? { ...lead, ...normalized, updatedAt: now() } : lead
    ),
  })
}

export function moveStage(id: string, stage: LeadStage, lostReason?: string) {
  const lead = snapshot.leads.find((item) => item.id === id)
  if (!lead || lead.stage === stage) return
  const hasQuote = snapshot.quotes.some((quote) => quote.leadId === id)
  const blocked = stageMoveBlock(lead.stage, stage, hasQuote)
  if (blocked) return
  const activity: Activity = {
    id: uid("act"),
    leadId: id,
    accountId: lead.accountId,
    type: "stage",
    body: `Moved from ${lead.stage} to ${stage}${lostReason ? `. ${lostReason}` : ""}`,
    at: now(),
    authorId: lead.ownerId,
  }
  persist({
    ...snapshot,
    leads: snapshot.leads.map((item) =>
      item.id === id
        ? {
            ...item,
            stage,
            lostReason: stage === "lost" ? lostReason ?? item.lostReason : null,
            updatedAt: now(),
          }
        : item
    ),
    activities: [activity, ...snapshot.activities],
  })
}

export function addNote(leadId: string, body: string, authorId: string) {
  const activity: Activity = {
    id: uid("act"),
    leadId,
    accountId: snapshot.leads.find((l) => l.id === leadId)?.accountId ?? null,
    type: "note",
    body,
    at: now(),
    authorId,
  }
  persist({
    ...snapshot,
    activities: [activity, ...snapshot.activities],
    leads: snapshot.leads.map((lead) =>
      lead.id === leadId ? { ...lead, updatedAt: now() } : lead
    ),
  })
}

export function updateQuoteStatus(id: string, status: Quote["status"]) {
  persist({
    ...snapshot,
    quotes: snapshot.quotes.map((quote) => (quote.id === id ? { ...quote, status } : quote)),
  })
}

export function acceptQuoteByVoucher(voucherNo: string) {
  const needle = voucherNo.trim().toLowerCase()
  if (!needle) return null
  const quote = snapshot.quotes.find(
    (item) =>
      item.catalogVoucher?.toLowerCase() === needle || item.number.toLowerCase() === needle
  )
  if (!quote) return null
  updateQuoteStatus(quote.id, "accepted")
  return quote
}

export function addQuote(leadId: string, amount: number, note: string, catalogVoucher?: string) {
  const lead = snapshot.leads.find((item) => item.id === leadId)
  if (!lead) return
  const quote: Quote = {
    id: uid("qt"),
    leadId,
    accountId: lead.accountId,
    number: catalogVoucher || nextQuoteNumber(snapshot.quotes.map((q) => q.number)),
    amount,
    status: catalogVoucher ? "sent" : "sent",
    sentAt: now(),
    validUntil: new Date(Date.now() + 14 * 86400000).toISOString(),
    note,
    catalogVoucher: catalogVoucher ?? null,
  }
  const activity: Activity = {
    id: uid("act"),
    leadId,
    accountId: lead.accountId,
    type: "quote",
    body: catalogVoucher
      ? `Quote ${catalogVoucher} saved.`
      : `Quote ${quote.number} sent for ₹${amount.toLocaleString("en-IN")}.`,
    at: now(),
    authorId: lead.ownerId,
  }
  persist({
    ...snapshot,
    quotes: [quote, ...snapshot.quotes],
    activities: [activity, ...snapshot.activities],
    leads: snapshot.leads.map((item) =>
      item.id === leadId
        ? { ...item, stage: "quoted", estimatedValue: amount, updatedAt: now() }
        : item
    ),
  })
}

export function convertLead(id: string, input: ConvertInput) {
  const lead = snapshot.leads.find((item) => item.id === id)
  if (!lead) return null
  if (lead.accountId) {
    return snapshot.accounts.find((a) => a.id === lead.accountId) ?? null
  }
  const account: Account = {
    id: nextAccountId(snapshot.accounts.map((a) => a.id)),
    name: lead.company.replace(/^Walk-in:\s*/, ""),
    tradeType: lead.tradeType,
    segment: input.segment || segmentFromTrade(lead.tradeType),
    contactName: lead.contactName,
    phone: lead.phone,
    email: lead.email,
    city: lead.city,
    area: lead.area,
    address: input.address || `${lead.area}, ${lead.city}`,
    ownerId: lead.ownerId,
    creditLimit: input.creditLimit,
    paymentTerms: input.paymentTerms,
    gstin: input.gstin,
    openedAt: now(),
    sourceLeadId: lead.id,
    notes: lead.brief,
    architectName: lead.architectName,
    architectFirm: lead.architectFirm,
    architectPhone: lead.architectPhone,
    architectEmail: lead.architectEmail,
  }
  const activity: Activity = {
    id: uid("act"),
    leadId: lead.id,
    accountId: account.id,
    type: "convert",
    body: `Saved as customer ${account.id}.`,
    at: now(),
    authorId: lead.ownerId,
  }
  persist({
    ...snapshot,
    accounts: [account, ...snapshot.accounts],
    activities: [activity, ...snapshot.activities],
    quotes: snapshot.quotes.map((quote) =>
      quote.leadId === id ? { ...quote, accountId: account.id } : quote
    ),
    leads: snapshot.leads.map((item) =>
      item.id === id
        ? { ...item, accountId: account.id, updatedAt: now() }
        : item
    ),
  })
  return account
}

export function closeEnquiry(leadId: string) {
  const lead = snapshot.leads.find((item) => item.id === leadId)
  if (!lead) return null
  if (lead.stage === "won") return lead
  const activity: Activity = {
    id: uid("act"),
    leadId,
    accountId: lead.accountId,
    type: "stage",
    body: "Enquiry closed.",
    at: now(),
    authorId: lead.ownerId,
  }
  persist({
    ...snapshot,
    activities: [activity, ...snapshot.activities],
    leads: snapshot.leads.map((item) =>
      item.id === leadId ? { ...item, stage: "won" as const, updatedAt: now() } : item
    ),
  })
  return snapshot.leads.find((item) => item.id === leadId) ?? null
}


export function updateAccount(id: string, patch: Partial<Account>) {
  const normalized = { ...patch }
  if (normalized.phone) normalized.phone = normalizeIndianPhone(normalized.phone)
  if (normalized.architectPhone)
    normalized.architectPhone = normalizeIndianPhone(normalized.architectPhone)
  if (normalized.city) normalized.city = normalizeIndianCity(normalized.city)
  persist({
    ...snapshot,
    accounts: snapshot.accounts.map((account) =>
      account.id === id ? { ...account, ...normalized } : account
    ),
  })
}

export function addAccountNote(accountId: string, body: string, authorId: string) {
  const activity: Activity = {
    id: uid("act"),
    leadId: snapshot.accounts.find((a) => a.id === accountId)?.sourceLeadId ?? null,
    accountId,
    type: "note",
    body,
    at: now(),
    authorId,
  }
  persist({
    ...snapshot,
    activities: [activity, ...snapshot.activities],
  })
}

export function addFollowUp(input: {
  accountId?: string | null
  leadId?: string | null
  kind: FollowUpKind
  dueAt: string
  note: string
  authorId: string
}) {
  const followUp: FollowUp = {
    id: uid("fu"),
    accountId: input.accountId ?? null,
    leadId: input.leadId ?? null,
    kind: input.kind,
    dueAt: input.dueAt,
    note: input.note,
    doneAt: null,
    createdAt: now(),
    authorId: input.authorId,
  }
  persist({
    ...snapshot,
    followUps: [followUp, ...(snapshot.followUps || [])],
  })
  return followUp
}

export function completeFollowUp(id: string) {
  persist({
    ...snapshot,
    followUps: (snapshot.followUps || []).map((item) =>
      item.id === id ? { ...item, doneAt: now() } : item
    ),
  })
}

export function searchAccounts(query: string, segment?: CustomerSegment | "all") {
  const needle = query.trim().toLowerCase()
  return snapshot.accounts.filter((account) => {
    if (segment && segment !== "all" && account.segment !== segment) return false
    if (!needle) return true
    return [account.name, account.contactName, account.phone, account.gstin, account.email, account.city]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  })
}


export function resetDemo() {
  persist(EMPTY_CRM)
}

function hydrate() {
  snapshot = load()
  emit()
}

const CrmContext = createContext<CrmSnapshot>(EMPTY_CRM)

export function CrmProvider({ children }: { children: ReactNode }) {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_CRM)
  const value = useMemo(() => data, [data])
  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>
}

export function useCrm() {
  return useContext(CrmContext)
}

export function useStaff(id: string) {
  const { staff } = useCrm()
  return staff.find((person) => person.id === id)
}

if (typeof window !== "undefined") {
  hydrate()
}
