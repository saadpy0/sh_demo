"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SEGMENT_LABEL, TRADE_LABEL } from "@/lib/crm/labels"
import { useCrm } from "@/lib/crm/store"
import type { CustomerSegment } from "@/lib/crm/types"
import Link from "next/link"
import { useMemo, useState } from "react"

export function ClientList() {
  const { accounts, staff, quotes, followUps } = useCrm()
  const [query, setQuery] = useState("")
  const [segment, setSegment] = useState<CustomerSegment | "all">("all")

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return accounts.filter((account) => {
      if (segment !== "all" && account.segment !== segment) return false
      if (!needle) return true
      return [account.name, account.contactName, account.phone, account.gstin, account.email, account.city, account.address]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    })
  }, [accounts, query, segment])

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No customers yet. When a deal is sold, save them here.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="max-w-[68ch] text-sm text-muted-foreground">
        People you sell to. Search by name, phone, or tax number.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[240px] flex-1 gap-1.5">
          <Label htmlFor="client-search">Search</Label>
          <Input
            id="client-search"
            type="search"
            placeholder="Name, phone, tax number…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="grid w-full gap-1.5 sm:w-52">
          <Label htmlFor="client-segment">Customer type</Label>
          <Select
            value={segment}
            onValueChange={(value) => setSegment(value as CustomerSegment | "all")}
          >
            <SelectTrigger id="client-segment" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All segments</SelectItem>
              {(Object.keys(SEGMENT_LABEL) as CustomerSegment[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SEGMENT_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Tax no.</th>
              <th className="px-3 py-2 font-medium">Referral</th>
              <th className="px-3 py-2 font-medium text-right">Quotes</th>
              <th className="px-3 py-2 font-medium text-right">Reminders</th>
              <th className="px-3 py-2 font-medium">Staff</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No customers match that search.
                </td>
              </tr>
            ) : (
              filtered.map((account) => {
                const owner = staff.find((person) => person.id === account.ownerId)
                const quoteCount = quotes.filter(
                  (quote) =>
                    quote.accountId === account.id ||
                    (account.sourceLeadId && quote.leadId === account.sourceLeadId)
                ).length
                const openFollowUps = (followUps || []).filter(
                  (item) => item.accountId === account.id && !item.doneAt
                ).length
                return (
                  <tr key={account.id} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs">
                      <Link href={`/clients/${account.id}`} className="hover:underline">
                        {account.id}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/clients/${account.id}`} className="font-medium hover:underline">
                        {account.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {account.contactName} · {account.phone} · {TRADE_LABEL[account.tradeType]}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">{SEGMENT_LABEL[account.segment]}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{account.gstin || "—"}</td>
                    <td className="px-3 py-2.5 text-sm">
                      {account.architectName ? (
                        <span>
                          {account.architectName}
                          {account.architectFirm ? (
                            <span className="block text-xs text-muted-foreground">{account.architectFirm}</span>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{quoteCount}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">{openFollowUps}</td>
                    <td className="px-3 py-2.5">{owner?.name}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
