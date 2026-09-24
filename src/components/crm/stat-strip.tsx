"use client"

import { money } from "@/lib/crm/format"
import { isOpenEnquiry } from "@/lib/crm/labels"
import { useCrm } from "@/lib/crm/store"

export function StatStrip() {
  const { leads } = useCrm()
  const open = leads.filter((lead) => isOpenEnquiry(lead.stage))
  const pipeline = open.reduce((sum, lead) => sum + lead.estimatedValue, 0)
  const today = new Date().toISOString().slice(0, 10)
  const loggedToday = leads.filter((lead) => lead.createdAt.slice(0, 10) === today).length
  const overdue = open.filter(
    (lead) => lead.nextAction && new Date(lead.nextAction.dueAt).getTime() < Date.now()
  ).length
  const closed = leads.filter((lead) => lead.stage === "won" || lead.stage === "lost")
  const won = leads.filter((lead) => lead.stage === "won").length
  const win = closed.length ? Math.round((won / closed.length) * 100) : 0

  const items = [
    { label: "Work open", value: money(pipeline) },
    { label: "New today", value: String(loggedToday) },
    { label: "Overdue", value: String(overdue) },
    { label: "Sold", value: `${win}%` },
  ]

  return (
    <dl className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-card px-4 py-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 font-mono text-xl font-medium tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
