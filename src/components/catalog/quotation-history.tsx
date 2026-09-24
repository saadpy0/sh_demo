"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatQuotationDate } from "@/lib/catalog/format-date"
import { formatListPrice } from "@/lib/catalog/money"
import type { Quotation, QuotationSummary } from "@/lib/catalog/types"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

const PAGE_SIZE = 50

type QuotationHistoryProps = {
  onView: (quotation: Quotation) => void
  onReorder: (quotation: Quotation) => void
  refreshKey?: number
}

export function QuotationHistory({ onView, onReorder, refreshKey = 0 }: QuotationHistoryProps) {
  const [rows, setRows] = useState<QuotationSummary[]>([])
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const loadPage = useCallback(async (nextOffset: number, replace: boolean) => {
    if (nextOffset === 0) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await fetch(`/api/quotations?limit=${PAGE_SIZE}&offset=${nextOffset}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Could not load history")
      const results = (data.results || []) as QuotationSummary[]
      setRows((current) => (replace ? results : [...current, ...results]))
      setHasMore(Boolean(data.hasMore))
      setOffset(nextOffset + results.length)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load history")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    setOffset(0)
    loadPage(0, true)
  }, [loadPage, refreshKey])

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      [row.voucherNo, row.shipToName, row.billToName].some((value) => value.toLowerCase().includes(q))
    )
  }, [filter, rows])

  async function openQuotation(id: number, action: "view" | "reorder") {
    try {
      const res = await fetch(`/api/quotations/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Not found")
      if (action === "view") onView(data as Quotation)
      else onReorder(data as Quotation)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open quote")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Past quotes</h2>
          <p className="text-sm text-muted-foreground">Print again or copy into a new quote.</p>
        </div>
        <Input
          type="search"
          placeholder="Search quote no. or customer…"
          className="max-w-sm"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Quote no.</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Deliver to</th>
              <th className="px-3 py-2 font-medium">Bill to</th>
              <th className="px-3 py-2 font-medium text-right">Total</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No quotes found.
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.id} className="border-b border-border/70 last:border-0">
                  <td className="px-3 py-2 font-mono">{row.voucherNo}</td>
                  <td className="px-3 py-2">{formatQuotationDate(row.quotationDate)}</td>
                  <td className="px-3 py-2">{row.shipToName}</td>
                  <td className="px-3 py-2">{row.billToName}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatListPrice(row.grandTotal)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button type="button" size="sm" variant="outline" onClick={() => openQuotation(row.id, "view")}>
                        View
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openQuotation(row.id, "reorder")}
                      >
                        New quote
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!filter && hasMore ? (
        <Button type="button" variant="outline" disabled={loadingMore} onClick={() => loadPage(offset, false)}>
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  )
}
