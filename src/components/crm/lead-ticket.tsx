"use client"

import { Badge } from "@/components/ui/badge"
import { dueLabel, money } from "@/lib/crm/format"
import { architectLabel, SOURCE_LABEL } from "@/lib/crm/labels"
import { useCrm } from "@/lib/crm/store"
import type { Lead } from "@/lib/crm/types"
import Link from "next/link"

export function LeadTicket({ lead }: { lead: Lead }) {
  const { staff } = useCrm()
  const owner = staff.find((person) => person.id === lead.ownerId)
  const overdue = lead.nextAction && new Date(lead.nextAction.dueAt).getTime() < Date.now()
  const broughtBy = architectLabel(lead.architectName, lead.architectFirm)

  return (
    <Link
      href={`/leads/${lead.id}`}
      className="block cursor-pointer rounded-md border border-border bg-card p-3 shadow-[0_1px_0_rgba(28,32,38,0.04)] transition-transform active:scale-[0.99]"
    >
      <p className="font-mono text-[11px] font-medium text-foreground/70">{lead.ticket}</p>
      <p className="mt-2 text-sm font-semibold leading-snug">{lead.company}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {lead.contactName !== lead.company ? `${lead.contactName} · ` : ""}
        {lead.phone}
      </p>
      {broughtBy ? <p className="mt-1 text-xs text-muted-foreground">Referral · {broughtBy}</p> : null}
      <p className="mt-2 font-mono text-sm tabular-nums">{money(lead.estimatedValue)}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="secondary" className="font-normal">
          {SOURCE_LABEL[lead.source]}
        </Badge>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{owner?.name.split(" ")[0]}</span>
        {lead.nextAction ? (
          <span className={overdue ? "font-medium text-destructive" : ""}>
            {dueLabel(lead.nextAction.dueAt)}
          </span>
        ) : (
          <span>No next step</span>
        )}
      </div>
    </Link>
  )
}
