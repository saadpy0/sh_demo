"use client"

import { ProformaPrintOverlay } from "@/components/catalog/proforma-invoice"
import { QuotationHistory } from "@/components/catalog/quotation-history"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { beginQuoteForLead, readCart, readQuoteLeadId, writeCart } from "@/lib/catalog/cart"
import { formatListPrice, lineAmount, roundMoney } from "@/lib/catalog/money"
import { DEFAULT_CURRENCY, normalizeIndianPhone } from "@/lib/locale/india"
import { productImageUrl } from "@/lib/catalog/product-image"
import type { CartItem, Party, Quotation } from "@/lib/catalog/types"
import { useFloor } from "@/components/floor/floor-provider"
import { useEffect, useMemo, useState } from "react"
import { addQuote, useCrm } from "@/lib/crm/store"
import { architectLabel, isOpenEnquiry } from "@/lib/crm/labels"
import { toast } from "sonner"
import Link from "next/link"

const emptyParty: Party = { name: "", address: "", contact: "", email: "" }

export function QuoteBuilder({ initialLeadId = "" }: { initialLeadId?: string }) {
  const { phone } = useFloor()
  const crm = useCrm()
  const [leadId, setLeadId] = useState(initialLeadId || "")
  const [items, setItems] = useState<CartItem[]>([])
  const [shipTo, setShipTo] = useState<Party>(emptyParty)
  const [billTo, setBillTo] = useState<Party>(emptyParty)
  const [sameBill, setSameBill] = useState(true)
  const [hideDiscount, setHideDiscount] = useState(false)
  const [packaging, setPackaging] = useState(0)
  const [voucher, setVoucher] = useState("")
  const [saving, setSaving] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [tab, setTab] = useState("builder")
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [printQuote, setPrintQuote] = useState<Quotation | null>(null)
  const [printReturnTab, setPrintReturnTab] = useState<"builder" | "history">("builder")
  const [autoPrint, setAutoPrint] = useState(false)

  const selectedLead = crm.leads.find((lead) => lead.id === leadId) || null
  const openLeads = crm.leads.filter((lead) => isOpenEnquiry(lead.stage))

  function applyLead(id: string) {
    const lead = crm.leads.find((item) => item.id === id)
    if (!lead || !isOpenEnquiry(lead.stage)) {
      setLeadId("")
      return
    }
    beginQuoteForLead(id)
    setLeadId(id)
    setItems(readCart())
    const address = [lead.area, lead.city].filter(Boolean).join(", ")
    setShipTo({
      name: lead.company.replace(/^Walk-in:\s*/, ""),
      contact: lead.phone,
      email: lead.email,
      address,
    })
  }

  useEffect(() => {
    const fromUrl = initialLeadId
    const stored = readQuoteLeadId()
    const next = fromUrl || stored
    if (next) applyLead(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLeadId, crm.leads.length])

  useEffect(() => {
    setItems(readCart())
    fetch("/api/quotations?next=1")
      .then((res) => res.json())
      .then((data) => setVoucher(data.voucherNo || "BTH-1001"))
  }, [])

  function persist(next: CartItem[]) {
    setItems(next)
    writeCart(next)
  }

  const total = useMemo(() => {
    const lines = items.reduce((sum, item) => sum + (lineAmount(item) || 0), 0)
    return roundMoney(lines + packaging)
  }, [items, packaging])

  async function save() {
    if (!leadId || !selectedLead) {
      toast.error("Pick who this quote is for. Start from an enquiry if you need a new name.")
      return
    }
    const partyBill = sameBill ? shipTo : billTo
    if (!shipTo.name || !shipTo.contact) {
      toast.error("Customer name and phone are required")
      return
    }
    if (items.some((item) => item.unitPrice == null)) {
      toast.error("Every line needs a price. Fill missing prices first.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherNo: voucher,
          hideDiscount,
          packagingForwarding: packaging,
          shipTo,
          billTo: partyBill,
          items,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Save failed")
      const quote = data as Quotation
      toast.success(`Saved ${quote.voucherNo}`)
      addQuote(leadId, Number(quote.grandTotal || 0), `Quote ${quote.voucherNo}`, quote.voucherNo)
      persist([])
      setHistoryRefresh((n) => n + 1)
      const next = await fetch("/api/quotations?next=1").then((r) => r.json())
      setVoucher(next.voucherNo)
      setPrintReturnTab("builder")
      setAutoPrint(!phone)
      setPrintQuote(quote)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  function applyQuoteToCart(quote: Quotation) {
    persist(
      quote.items.map((item) => ({
        productId: item.productId,
        code: item.code,
        itemName: item.itemName,
        collection: item.collection,
        supplier: item.supplier || "",
        imageUrl: item.imageUrl || null,
        finish: item.finish,
        exactFinish: item.exactFinish || item.finish,
        size: item.size,
        color: item.color,
        unitPrice: item.unitPrice,
        currency: DEFAULT_CURRENCY,
        quantity: item.quantity,
        discountPct: item.discountPct,
        gstPct: item.gstPct,
      }))
    )
    setShipTo({ ...quote.shipTo, contact: normalizeIndianPhone(quote.shipTo.contact) })
    setBillTo({ ...quote.billTo, contact: normalizeIndianPhone(quote.billTo.contact) })
    setSameBill(
      quote.shipTo.name === quote.billTo.name && quote.shipTo.contact === quote.billTo.contact
    )
    setHideDiscount(quote.hideDiscount)
    setPackaging(quote.packagingForwarding)
  }

  function reorderQuote(quote: Quotation) {
    if (items.length && !window.confirm("This replaces the items currently in this quote. Continue?")) {
      return
    }
    applyQuoteToCart(quote)
    setTab("builder")
    toast.success(`Loaded ${quote.voucherNo} into this quote`)
  }

  function openPrintFromHistory(quote: Quotation) {
    setPrintReturnTab("history")
    setAutoPrint(false)
    setPrintQuote(quote)
  }

  function closePrint() {
    setPrintQuote(null)
    setAutoPrint(false)
    if (printReturnTab === "history") setTab("history")
  }

  const draftQuotation = useMemo((): Quotation | null => {
    if (!items.length || items.some((item) => item.unitPrice == null)) return null
    const partyBill = sameBill ? shipTo : billTo
    const mapped = items.map((item, index) => ({
      productId: item.productId,
      code: item.code,
      itemName: item.itemName,
      collection: item.collection,
      supplier: item.supplier || "",
      imageUrl: item.imageUrl || null,
      finish: item.finish,
      exactFinish: item.exactFinish,
      size: item.size,
      color: item.color,
      hsnSac: null,
      unitPrice: item.unitPrice as number,
      currency: DEFAULT_CURRENCY,
      quantity: item.quantity,
      discountPct: item.discountPct,
      gstPct: item.gstPct,
      lineAmount: lineAmount({ ...item, unitPrice: item.unitPrice }) ?? 0,
    }))
    return {
      id: 0,
      voucherNo: voucher || "Draft",
      quotationDate: new Date().toISOString().slice(0, 10),
      hideDiscount,
      packagingForwarding: packaging,
      shipTo,
      billTo: partyBill,
      items: mapped,
      grandTotal: total,
    }
  }, [items, shipTo, billTo, sameBill, hideDiscount, packaging, voucher, total])

  return (
    <>
      {printQuote ? (
        <ProformaPrintOverlay
          quotation={printQuote}
          onClose={closePrint}
          closeLabel={printReturnTab === "history" ? "Back to past quotes" : "Start a new quote"}
          autoPrint={autoPrint}
        />
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList className="w-full">
          <TabsTrigger value="builder">New quote</TabsTrigger>
          <TabsTrigger value="history">Past quotes</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <QuotationHistory
            refreshKey={historyRefresh}
            onView={openPrintFromHistory}
            onReorder={reorderQuote}
          />
        </TabsContent>

        <TabsContent value="builder">
          <div className="space-y-6">
      <section className="space-y-4">
        <div className="rounded-md border border-border bg-card p-4">
          <Label>Who is this for</Label>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Select value={leadId} onValueChange={(value) => value && applyLead(value)}>
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
            <Button
              nativeButton={false}
              render={<Link href={leadId ? `/library?lead=${leadId}` : "/library"} />}
              variant="outline"
              size="sm"
            >
              Catalogue
            </Button>
          </div>
          {selectedLead ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedLead.contactName} · {selectedLead.phone}
              {architectLabel(selectedLead.architectName, selectedLead.architectFirm)
                ? ` · Referral: ${architectLabel(selectedLead.architectName, selectedLead.architectFirm)}`
                : ""}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Every quote sits on an enquiry. Add the person first if they are new.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Quote no.</p>
            <p className="font-mono text-lg">{voucher}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setManualOpen((v) => !v)}>
            Add a line
          </Button>
        </div>

        {manualOpen ? <ManualLine onAdd={(item) => persist([...items, item])} /> : null}

        {phone ? (
          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                Cart is empty. Add items from the catalogue.
              </p>
            ) : (
              items.map((item, index) => {
                const image = item.imageUrl || productImageUrl(item.supplier || "", item.code)
                const variant = [item.exactFinish || item.finish, item.size, item.color]
                  .filter(Boolean)
                  .join(" · ")
                return (
                  <article key={`${item.code}-${index}`} className="rounded-2xl border border-border bg-card p-3">
                    <div className="flex gap-3">
                      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/60">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt="" className="size-full object-contain" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-semibold">{item.code}</p>
                        <p className="text-sm leading-snug">{item.itemName}</p>
                        <p className="text-xs text-muted-foreground">{variant || item.supplier}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="grid gap-1 text-xs font-medium">
                        Qty
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => {
                            const next = items.map((row, i) =>
                              i === index ? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) } : row
                            )
                            persist(next)
                          }}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium">
                        Price
                        <Input
                          type="number"
                          value={item.unitPrice ?? ""}
                          onChange={(event) => {
                            const raw = event.target.value
                            const next = items.map((row, i) =>
                              i === index ? { ...row, unitPrice: raw === "" ? null : Number(raw) } : row
                            )
                            persist(next)
                          }}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium">
                        Disc %
                        <Input
                          type="number"
                          value={item.discountPct}
                          onChange={(event) => {
                            const next = items.map((row, i) =>
                              i === index ? { ...row, discountPct: Number(event.target.value) || 0 } : row
                            )
                            persist(next)
                          }}
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium">
                        GST %
                        <select
                          className="h-[52px] rounded-[14px] border border-input bg-background px-2 text-base"
                          value={item.gstPct}
                          onChange={(event) => {
                            const next = items.map((row, i) =>
                              i === index ? { ...row, gstPct: Number(event.target.value) } : row
                            )
                            persist(next)
                          }}
                        >
                          <option value={5}>5</option>
                          <option value={18}>18</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="font-mono text-lg font-semibold">{formatListPrice(lineAmount(item))}</p>
                      <button
                        type="button"
                        className="cursor-pointer text-sm font-medium text-destructive"
                        onClick={() => persist(items.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium"> </th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Variant</th>
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Disc %</th>
                <th className="px-3 py-2 font-medium">GST %</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const image = item.imageUrl || productImageUrl(item.supplier || "", item.code)
                const variant = [item.exactFinish || item.finish, item.size, item.color]
                  .filter(Boolean)
                  .join(" · ")
                return (
                <tr key={`${item.code}-${index}`} className="border-b border-border/70 last:border-0 align-top">
                  <td className="px-3 py-3">
                    <div className="flex size-16 items-center justify-center overflow-hidden rounded-md bg-muted/60">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No image</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-lg font-semibold leading-tight tracking-tight">
                      {item.supplier || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-mono text-sm font-medium">{item.code}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.itemName}</p>
                  </td>
                  <td className="px-3 py-3 text-sm text-muted-foreground">
                    {variant || "—"}
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      className="w-16"
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => {
                        const next = items.map((row, i) =>
                          i === index ? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) } : row
                        )
                        persist(next)
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      className="w-24"
                      type="number"
                      value={item.unitPrice ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value
                        const next = items.map((row, i) =>
                          i === index
                            ? { ...row, unitPrice: raw === "" ? null : Number(raw) }
                            : row
                        )
                        persist(next)
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      className="w-16"
                      type="number"
                      value={item.discountPct}
                      onChange={(event) => {
                        const next = items.map((row, i) =>
                          i === index ? { ...row, discountPct: Number(event.target.value) || 0 } : row
                        )
                        persist(next)
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2"
                      value={item.gstPct}
                      onChange={(event) => {
                        const next = items.map((row, i) =>
                          i === index ? { ...row, gstPct: Number(event.target.value) } : row
                        )
                        persist(next)
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={18}>18</option>
                    </select>
                  </td>
                  <td className="px-3 py-3 font-mono tabular-nums">
                    {formatListPrice(lineAmount(item))}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="cursor-pointer text-xs text-destructive"
                      onClick={() => persist(items.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Cart is empty. Add items from the catalogue.
            </p>
          ) : null}
        </div>
        )}

        <div className="grid gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-3">
          <label className="grid gap-1 text-xs">
            Packing and forwarding
            <Input
              type="number"
              value={packaging}
              onChange={(event) => setPackaging(Number(event.target.value) || 0)}
            />
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input
              type="checkbox"
              checked={hideDiscount}
              onChange={(event) => setHideDiscount(event.target.checked)}
            />
            Hide discount on the print
          </label>
          <p className="self-end text-right font-mono text-xl tabular-nums">{formatListPrice(total)}</p>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Deliver to</h2>
        <div className="mt-3 grid gap-6 md:grid-cols-2">
          <PartyFields value={shipTo} onChange={setShipTo} />
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sameBill}
                onChange={(event) => setSameBill(event.target.checked)}
              />
              Same for the bill
            </label>
            {!sameBill ? (
              <>
                <h2 className="mt-4 text-sm font-semibold">Bill to</h2>
                <PartyFields value={billTo} onChange={setBillTo} />
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving" : "Save quote"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!draftQuotation}
            onClick={() => {
              if (!draftQuotation) return
              setPrintReturnTab("builder")
              setAutoPrint(false)
              setPrintQuote(draftQuotation)
            }}
          >
            Preview print
          </Button>
        </div>
      </section>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}

function PartyFields({ value, onChange }: { value: Party; onChange: (value: Party) => void }) {
  return (
    <div className="mt-3 grid gap-2">
      <div className="grid gap-1.5">
        <Label>Name</Label>
        <Input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} />
      </div>
      <div className="grid gap-1.5">
        <Label>Phone</Label>
        <Input
          value={value.contact}
          onChange={(event) => onChange({ ...value, contact: event.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Email</Label>
        <Input
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Address</Label>
        <Textarea
          rows={3}
          value={value.address}
          onChange={(event) => onChange({ ...value, address: event.target.value })}
        />
      </div>
    </div>
  )
}

function ManualLine({ onAdd }: { onAdd: (item: CartItem) => void }) {
  const [itemName, setItemName] = useState("")
  const [code, setCode] = useState("")
  const [finish, setFinish] = useState("")
  const [price, setPrice] = useState("")

  return (
    <form
      className="grid gap-2 rounded-md border border-border bg-card p-3 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!itemName || price === "") return
        onAdd({
          productId: null,
          code: code || "MANUAL",
          itemName,
          collection: null,
          supplier: "",
          imageUrl: null,
          finish,
          exactFinish: finish,
          size: null,
          color: null,
          unitPrice: Number(price),
          currency: DEFAULT_CURRENCY,
          quantity: 1,
          discountPct: 0,
          gstPct: 18,
        })
        setItemName("")
        setCode("")
        setFinish("")
        setPrice("")
      }}
    >
      <Input placeholder="Item name" value={itemName} onChange={(e) => setItemName(e.target.value)} />
      <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
      <Input placeholder="Finish" value={finish} onChange={(e) => setFinish(e.target.value)} />
      <div className="flex gap-2">
        <Input placeholder="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Button type="submit">Add</Button>
      </div>
    </form>
  )
}
