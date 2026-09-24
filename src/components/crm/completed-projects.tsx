"use client"

import { Input } from "@/components/ui/input"
import { money, shortDate } from "@/lib/crm/format"
import { architectLabel, isCompletedProject, SOURCE_LABEL, TRADE_LABEL } from "@/lib/crm/labels"
import { useCrm } from "@/lib/crm/store"
import Link from "next/link"
import { useMemo, useState } from "react"

export function CompletedProjects() {
  const { leads, quotes, staff } = useCrm()
  const [q, setQ] = useState("")

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return leads
      .filter((lead) => isCompletedProject(lead.stage))
      .filter((lead) => {
        if (!query) return true
        const hay = `${lead.ticket} ${lead.company} ${lead.contactName} ${lead.phone} ${lead.city}`.toLowerCase()
        return hay.includes(query)
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [leads, q])

  return (
    <div className="space-y-4">
      <p className="max-w-[68ch] text-sm text-muted-foreground">
        Jobs you closed on the enquiry. Quotes for these people no longer show when making a new quote.
      </p>
      <Input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Search name, company, phone"
        className="md:max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">No.</th>
              <th className="px-3 py-2 font-medium">Project</th>
              <th className="px-3 py-2 font-medium">Quotes</th>
              <th className="px-3 py-2 font-medium">Sold</th>
              <th className="px-3 py-2 font-medium">Staff</th>
              <th className="px-3 py-2 font-medium">Closed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => {
              const person = staff.find((item) => item.id === lead.ownerId)
              const jobQuotes = quotes.filter((quote) => quote.leadId === lead.id)
              const sold = jobQuotes
                .filter((quote) => quote.status === "accepted")
                .reduce((sum, quote) => sum + quote.amount, 0)
              const referral = architectLabel(lead.architectName, lead.architectFirm)
              return (
                <tr key={lead.id} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <Link href={`/leads/${lead.id}`} className="hover:underline">
                      {lead.ticket}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.company}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {lead.contactName} · {TRADE_LABEL[lead.tradeType]} · {SOURCE_LABEL[lead.source]}
                      {referral ? ` · ${referral}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">{jobQuotes.length}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">{sold ? money(sold) : "—"}</td>
                  <td className="px-3 py-2.5">{person?.name}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{shortDate(lead.updatedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            {q.trim()
              ? "No matches."
              : "Nothing closed yet. Close the enquiry when the job is finished."}
          </p>
        ) : null}
      </div>
    </div>
  )
}
