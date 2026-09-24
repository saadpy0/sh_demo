"use client"

import { ProductCard } from "@/components/catalog/product-card"
import { ScanQrDialog } from "@/components/catalog/scan-qr-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { beginQuoteForLead, cartCount, clearQuoteLead, subscribeCart } from "@/lib/catalog/cart"
import { useCrm } from "@/lib/crm/store"
import { isOpenEnquiry } from "@/lib/crm/labels"
import type { LibraryScanHint } from "@/lib/catalog/resolve-library-scan"
import type { CatalogProduct, FilterOptions } from "@/lib/catalog/types"
import { useFloor } from "@/components/floor/floor-provider"
import { MagnifyingGlassIcon, QrCodeIcon, ShoppingCartIcon, SlidersHorizontalIcon } from "@phosphor-icons/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

const emptyFilters: FilterOptions = {
  suppliers: [],
  categories: [],
  collections: [],
  finishes: [],
  sizes: [],
}

export function LibraryBrowser({ leadId = "" }: { leadId?: string }) {
  const [q, setQ] = useState("")
  const [brands, setBrands] = useState<string[]>([])
  const [category, setCategory] = useState("")
  const [collection, setCollection] = useState("")
  const [finish, setFinish] = useState("")
  const [size, setSize] = useState("")
  const [filters, setFilters] = useState<FilterOptions>(emptyFilters)
  const [results, setResults] = useState<CatalogProduct[]>([])
  const [total, setTotal] = useState(0)
  const [source, setSource] = useState("seed")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [scanOpen, setScanOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [scanHint, setScanHint] = useState<LibraryScanHint | null>(null)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [mode, setMode] = useState<"browse" | "quote">(leadId ? "quote" : "browse")
  const crm = useCrm()
  const { phone } = useFloor()
  const router = useRouter()

  useEffect(() => subscribeCart(() => setCount(cartCount())), [])
  useEffect(() => setCount(cartCount()), [])
  const quotingLead = leadId ? crm.leads.find((lead) => lead.id === leadId) : undefined
  useEffect(() => {
    if (!leadId) {
      setMode("browse")
      clearQuoteLead()
      return
    }
    if (quotingLead && !isOpenEnquiry(quotingLead.stage)) {
      setMode("browse")
      clearQuoteLead()
      router.replace("/library")
      return
    }
    setMode("quote")
    if (quotingLead) beginQuoteForLead(leadId)
  }, [leadId, quotingLead, router])

  const quoting = mode === "quote"
  const extraFilterCount = [category, collection, finish, size].filter(Boolean).length
  const activeLead = quoting && leadId ? crm.leads.find((lead) => lead.id === leadId) || null : null
  const openLeads = crm.leads.filter((lead) => isOpenEnquiry(lead.stage))
  const quotesHref = leadId ? `/quotes?lead=${leadId}` : "/quotes"

  function goBrowse() {
    setMode("browse")
    clearQuoteLead()
    router.replace("/library")
  }

  function goQuote() {
    setMode("quote")
  }

  function pickLead(id: string) {
    beginQuoteForLead(id)
    router.replace(`/library?lead=${id}`)
  }

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    for (const brand of brands) params.append("brand", brand)
    if (category) params.set("category", category)
    if (collection) params.set("collection", collection)
    if (finish) params.set("finish", finish)
    if (size) params.set("size", size)
    params.set("limit", "48")
    return params
  }, [q, brands, category, collection, finish, size])

  useEffect(() => {
    const filterParams = new URLSearchParams({ meta: "filters" })
    for (const brand of brands) filterParams.append("brand", brand)
    if (category) filterParams.set("category", category)
    if (collection) filterParams.set("collection", collection)
    fetch(`/api/catalog?${filterParams}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.detail) return
        setFilters(data)
        setSource(data.source || source)
      })
      .catch(() => {})
  }, [brands, category, collection, source])

  async function runSearch(event?: React.FormEvent) {
    event?.preventDefault()
    setLoading(true)
    setError(null)
    setHighlightedId(null)
    setScanHint(null)
    try {
      const res = await fetch(`/api/catalog?${query}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Search failed")
      setResults(data.results || [])
      setTotal(data.total || 0)
      setSource(data.source || source)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void runSearch()
    // First paint: show a default slice so the library is not an empty box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleBrand(name: string) {
    setBrands((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    )
  }

  function pickProduct(products: CatalogProduct[], hint: LibraryScanHint) {
    const needle = hint.query.trim().toLowerCase()
    const exact = products.find((item) => item.code.trim().toLowerCase() === needle)
    const starts = products.find((item) => item.code.trim().toLowerCase().startsWith(needle))
    return exact || starts || products[0] || null
  }

  async function openScannedProduct(hint: LibraryScanHint) {
    setScanHint(hint)
    setQ(hint.query)
    setCategory("")
    setCollection("")
    setFinish("")
    setSize("")
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("q", hint.query)
      params.set("limit", "24")
      const res = await fetch(`/api/catalog?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Search failed")
      const rows = (data.results || []) as CatalogProduct[]
      const match = pickProduct(rows, hint)
      if (!match) {
        setResults([])
        setTotal(0)
        toast.error("No catalogue card for that label")
        return
      }
      setResults([match])
      setTotal(1)
      setSource(data.source || source)
      setHighlightedId(match.id)
      toast.success(match.code)
      requestAnimationFrame(() => {
        document.getElementById(`product-${match.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant={mode === "browse" ? "default" : "outline"} onClick={goBrowse}>
              Browse
            </Button>
            <Button type="button" size="sm" variant={mode === "quote" ? "default" : "outline"} onClick={goQuote}>
              Quote
            </Button>
          </div>
          <Link href={quotesHref} className="inline-flex items-center gap-2 text-sm font-medium">
            <ShoppingCartIcon className="size-4" />
            {quoting ? "Open quote" : "Quote"} {count ? `(${count})` : ""}
          </Link>
        </div>
        {quoting ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Select value={leadId} onValueChange={(value) => value && pickLead(value)}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Pick an enquiry" />
              </SelectTrigger>
              <SelectContent>
                {openLeads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.company} · {lead.ticket}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button nativeButton={false} render={<Link href="/leads/new" />} variant="outline" size="sm">
              New enquiry
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {total ? `${total} matches` : "Search or pick a brand"}
          </p>
        )}
        {activeLead ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {activeLead.phone}
            {activeLead.email ? ` · ${activeLead.email}` : ""}
          </p>
        ) : quoting && !leadId ? (
          <p className="mt-2 text-xs text-muted-foreground">Pick who this quote is for, then add items.</p>
        ) : null}
      </div>

      <form onSubmit={runSearch} className="grid gap-2">
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Code, item, size, finish"
            className="h-12 pl-10 text-base"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setScanOpen(true)}>
            <QrCodeIcon data-icon="inline-start" />
            Scan QR
          </Button>
          <Button type="button" variant={extraFilterCount ? "default" : "outline"} onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontalIcon data-icon="inline-start" />
            Filter{extraFilterCount ? ` (${extraFilterCount})` : ""}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Searching" : "Search"}
          </Button>
        </div>
      </form>

      <div
        className={
          phone ? "grid grid-cols-3 gap-2" : "flex flex-wrap gap-2"
        }
      >
        {filters.suppliers.map((name) => {
          const active = brands.includes(name)
          return (
            <button
              key={name}
              type="button"
              aria-pressed={active}
              aria-label={name}
              onClick={() => toggleBrand(name)}
              className={
                phone
                  ? `flex h-14 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 px-2 ${
                      active ? "border-primary outline-none ring-2 ring-primary/25" : "border-border hover:border-foreground/30"
                    }`
                  : `flex h-16 w-[168px] cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 px-4 ${
                      active ? "border-primary outline-none ring-2 ring-primary/25" : "border-border hover:border-foreground/30"
                    }`
              }
            >
              <span className="text-sm whitespace-nowrap">{name}</span>
            </button>
          )
        })}
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[80%] gap-0 rounded-t-3xl px-4 pb-6">
          <SheetHeader className="px-0 text-left">
            <SheetTitle>Filter items</SheetTitle>
          </SheetHeader>
          <div className="grid gap-3 py-2">
            <FilterSelect
              label="Category"
              value={category}
              options={filters.categories}
              onChange={(value) => {
                setCategory(value)
                setCollection("")
              }}
            />
            <FilterSelect
              label="Collection"
              value={collection}
              options={filters.collections}
              onChange={setCollection}
            />
            <FilterSelect label="Finish" value={finish} options={filters.finishes} onChange={setFinish} />
            <label className="grid gap-1 text-sm font-medium">
              Size
              <select
                className="h-12 rounded-xl border border-input bg-background px-3 text-base"
                value={size}
                onChange={(event) => setSize(event.target.value)}
              >
                <option value="">All</option>
                {filters.sizes.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-muted-foreground">Tap Search after you set these.</p>
          </div>
          <SheetFooter className="px-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCategory("")
                setCollection("")
                setFinish("")
                setSize("")
              }}
            >
              Clear
            </Button>
            <Button type="button" onClick={() => setFiltersOpen(false)}>
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {results.length === 0 && !loading ? (
        <p className="rounded-md border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No catalogue items yet. New ranges and photos will show up here once they are added.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {results.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              highlight={highlightedId === product.id}
              preset={
                highlightedId === product.id && scanHint
                  ? { finish: scanHint.finish, size: scanHint.size, color: scanHint.color }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <ScanQrDialog open={scanOpen} onOpenChange={setScanOpen} onScan={(hint) => void openScannedProduct(hint)} />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <select
        className="h-12 rounded-xl border border-input bg-background px-3 text-base"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  )
}
