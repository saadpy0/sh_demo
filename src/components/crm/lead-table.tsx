"use client"

import { useFloor } from "@/components/floor/floor-provider"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { dueLabel, money, shortDate } from "@/lib/crm/format"
import { isCompletedProject, SOURCE_LABEL, STAGE_LABEL, TRADE_LABEL } from "@/lib/crm/labels"
import { useCrm } from "@/lib/crm/store"
import type { LeadStage } from "@/lib/crm/types"
import Link from "next/link"
import { useMemo, useState } from "react"

export function LeadTable() {
  const { leads, staff } = useCrm()
  const { phone } = useFloor()
  const [q, setQ] = useState("")
  const [stage, setStage] = useState<string>("all")
  const [owner, setOwner] = useState<string>("all")

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return leads.filter((lead) => {
      if (isCompletedProject(lead.stage)) return false
      if (stage !== "all" && lead.stage !== stage) return false
      if (owner !== "all" && lead.ownerId !== owner) return false
      if (!query) return true
      const hay = `${lead.ticket} ${lead.company} ${lead.contactName} ${lead.phone} ${lead.city}`.toLowerCase()
      return hay.includes(query)
    })
  }, [leads, q, stage, owner])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={phone ? "Name or phone" : "Search name, company, phone"}
          className="md:max-w-sm"
        />
        <Select value={stage} onValueChange={(value) => value && setStage(value)}>
          <SelectTrigger className="md:w-44">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {(Object.keys(STAGE_LABEL) as LeadStage[])
              .filter((item) => !isCompletedProject(item))
              .map((item) => (
              <SelectItem key={item} value={item}>
                {STAGE_LABEL[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {phone ? null : (
          <Select value={owner} onValueChange={(value) => value && setOwner(value)}>
            <SelectTrigger className="md:w-48">
              <SelectValue placeholder="Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {staff.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {phone ? (
        <ul className="space-y-2">
          {rows.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/leads/${lead.id}`}
                className="block rounded-2xl border border-border bg-card px-4 py-3"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-base font-semibold leading-snug">{lead.company}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                    {STAGE_LABEL[lead.stage]}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{lead.phone}</span>
                <span className="mt-1 block font-mono text-sm">{money(lead.estimatedValue)}</span>
              </Link>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No matches. Add a new enquiry from Home.
            </li>
          ) : null}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">No.</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Staff</th>
                <th className="px-3 py-2 font-medium">Next</th>
                <th className="px-3 py-2 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => {
                const person = staff.find((item) => item.id === lead.ownerId)
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
                      </p>
                    </td>
                    <td className="px-3 py-2.5">{STAGE_LABEL[lead.stage]}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums">
                      {money(lead.estimatedValue)}
                    </td>
                    <td className="px-3 py-2.5">{person?.name}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {lead.nextAction ? dueLabel(lead.nextAction.dueAt) : "None"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {shortDate(lead.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              No matches. Add a new enquiry from the shop.
            </p>
          ) : null}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Finished jobs sit under <Link href="/projects" className="underline">Completed</Link>.
      </p>
    </div>
  )
}
