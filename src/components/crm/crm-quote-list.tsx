"use client"

import { ProformaPrintOverlay } from "@/components/catalog/proforma-invoice"
import type { Quotation } from "@/lib/catalog/types"
import { longDate, money } from "@/lib/crm/format"
import { QUOTE_STATUS_LABEL } from "@/lib/crm/labels"
import type { Quote } from "@/lib/crm/types"
import { useState } from "react"
import { toast } from "sonner"

export function CrmQuoteList({
  quotes,
  closeLabel = "Back",
}: {
  quotes: Quote[]
  closeLabel?: string
}) {
  const [view, setView] = useState<Quotation | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  async function openQuote(quote: Quote) {
    const voucher = (quote.catalogVoucher || quote.number).trim()
    setOpeningId(quote.id)
    try {
      const res = await fetch(`/api/quotations?voucher=${encodeURIComponent(voucher)}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          data.detail ||
            "Could not open this quote. Only quotes saved from the catalogue can be viewed here."
        )
      }
      setView(data as Quotation)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open quote")
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <>
      {view ? (
        <ProformaPrintOverlay quotation={view} onClose={() => setView(null)} closeLabel={closeLabel} />
      ) : null}
      <ul className="mt-3 space-y-2">
        {quotes.map((quote) => {
          const label = quote.catalogVoucher || quote.number
          const busy = openingId === quote.id
          return (
            <li key={quote.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => openQuote(quote)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-60"
              >
                <span className="font-mono underline-offset-2 hover:underline">{label}</span>
                <span className="font-mono tabular-nums">{money(quote.amount)}</span>
                <span className="text-muted-foreground">{QUOTE_STATUS_LABEL[quote.status]}</span>
                {quote.sentAt ? (
                  <span className="hidden text-xs text-muted-foreground sm:inline">{longDate(quote.sentAt)}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Tap a quote to view lines and print.</p>
    </>
  )
}
