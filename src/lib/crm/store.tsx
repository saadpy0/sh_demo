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
import { SEED } from "./seed"
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

const KEY = "shw-crm-v4"
const LEGACY_KEYS = ["bth-crm-v4", "bth-crm-v3", "bth-crm-v2", "bth-crm-v1"] as const

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
  if (typeof window === "undefined") return SEED
  try {
    let raw: string | null = null
    let rawKey: string | null = null
    for (const key of [KEY, ...LEGACY_KEYS]) {
      const value = window.localStorage.getItem(key)
      if (value) {
        raw = value
        rawKey = key
        break
      }
    }
    if (!raw) return SEED
    const parsed = JSON.parse(raw) as CrmSnapshot
    if (!parsed.leads?.length) return SEED
    const migrated = migrate(parsed)
    const needsSave = rawKey !== KEY || JSON.stringify(migrated) !== JSON.stringify(parsed)
    if (needsSave) {
      window.localStorage.setItem(KEY, JSON.stringify(migrated))
      for (const legacy of LEGACY_KEYS) {
        if (legacy !== rawKey) window.localStorage.removeItem(legacy)
      }
      if (rawKey && rawKey !== KEY) window.localStorage.removeItem(rawKey)
    }
    return migrated
  } catch {
    return SEED
  }
}

let snapshot: CrmSnapshot = SEED
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((fn) => fn())
}

function persist(next: CrmSnapshot) {
  snapshot = next
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next))
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
  persist(SEED)
}

function hydrate() {
  snapshot = load()
  emit()
}

const CrmContext = createContext<CrmSnapshot>(SEED)

export function CrmProvider({ children }: { children: ReactNode }) {
  const data = useSyncExternalStore(subscribe, getSnapshot, () => SEED)
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
