"use client"

import { useFloor } from "@/components/floor/floor-provider"
import { Button } from "@/components/ui/button"
import { COMPANY } from "@/lib/catalog/company"
import { formatQuotationDate } from "@/lib/catalog/format-date"
import { formatListPrice } from "@/lib/catalog/money"
import { numberToWordsINR } from "@/lib/catalog/number-words"
import type { Party, Quotation } from "@/lib/catalog/types"
import { cn } from "@/lib/utils"
import { useEffect, useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"

type ProformaPrintOverlayProps = {
  quotation: Quotation
  onClose: () => void
  closeLabel?: string
  autoPrint?: boolean
}

export function ProformaPrintOverlay({
  quotation,
  onClose,
  closeLabel = "Done",
  autoPrint = false,
}: ProformaPrintOverlayProps) {
  const { phone, overlayHostRef } = useFloor()
  const [, bump] = useState(0)

  useEffect(() => {
    document.body.dataset.printProforma = "true"
    return () => {
      delete document.body.dataset.printProforma
    }
  }, [])

  useEffect(() => {
    if (!autoPrint || phone) return
    const timer = window.setTimeout(() => triggerPrint(), 300)
    return () => window.clearTimeout(timer)
  }, [autoPrint, phone])

  useLayoutEffect(() => {
    if (phone) bump((n) => n + 1)
  }, [phone])

  function triggerPrint() {
    const originalTitle = document.title
    const restoreTitle = () => {
      document.title = originalTitle
      window.removeEventListener("afterprint", restoreTitle)
    }
    window.addEventListener("afterprint", restoreTitle)
    document.title = " "
    window.print()
  }

  const node = (
    <div
      className={cn(
        "proforma-print-root z-[100] h-full min-h-0 overflow-auto bg-zinc-100 p-3",
        !phone && "fixed inset-0 p-4 md:p-8"
      )}
    >
      <ProformaInvoiceSheet quotation={quotation} />
      <div className="print-hide mx-auto mt-4 flex max-w-[800px] flex-col gap-2 sm:flex-row">
        <Button type="button" className="min-h-12" onClick={triggerPrint}>
          Print / Save as PDF
        </Button>
        <Button type="button" variant="outline" className="min-h-12" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
    </div>
  )

  if (phone) {
    const host = overlayHostRef.current
    if (!host) return null
    return createPortal(node, host)
  }
  if (typeof document === "undefined") return node
  return createPortal(node, document.body)
}

export function ProformaInvoiceSheet({ quotation }: { quotation: Quotation }) {
  const hideDiscount = quotation.hideDiscount
  const itemsSubtotal = quotation.items.reduce((sum, item) => sum + item.lineAmount, 0)
  const packaging = quotation.packagingForwarding || 0
  const footerSpan = hideDiscount ? 6 : 7

  return (
    <div className="invoice-sheet">
      <div className="invoice-page-header">
        <span className="invoice-logo-wordmark text-base font-semibold tracking-tight">{COMPANY.wordmark}</span>
      </div>
      <p className="invoice-title">PROFORMA INVOICE</p>

      <table className="invoice-frame">
        <tbody>
          <tr>
            <td className="invoice-company">
              <strong>{COMPANY.name}</strong>
              <br />
              {COMPANY.addressLines.map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
              {COMPANY.gstin}
            </td>
            <td className="invoice-voucher">
              <table className="invoice-voucher-table">
                <tbody>
                  <tr>
                    <td>
                      Quote No.
                      <br />
                      <strong>{quotation.voucherNo}</strong>
                    </td>
                    <td>
                      Dated
                      <br />
                      <strong>{formatQuotationDate(quotation.quotationDate)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td>{partyBlock("Deliver to", quotation.shipTo)}</td>
            <td>{partyBlock("Bill to", quotation.billTo)}</td>
          </tr>
        </tbody>
      </table>

      <table className="invoice-items-table">
        <thead>
          <tr>
            <th>Sl No.</th>
            <th>Description of Goods</th>
            <th>HSN/SAC</th>
            <th className="num">Quantity</th>
            <th className="num">Rate</th>
            {!hideDiscount ? <th className="num">Disc. %</th> : null}
            <th className="num">GST %</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {quotation.items.map((item, index) => {
            const netRate = item.unitPrice * (1 - (item.discountPct || 0) / 100)
            const specParts = [
              item.code,
              item.collection ? `— ${item.collection}` : "",
              `(${item.exactFinish || item.finish}${item.size ? `, ${item.size}` : ""}${item.color ? `, ${item.color}` : ""})`,
            ].filter(Boolean)
            return (
              <tr key={`${item.code}-${index}`}>
                <td>{index + 1}</td>
                <td>
                  <div>{item.itemName}</div>
                  <div>{specParts.join(" ")}</div>
                </td>
                <td>{item.hsnSac || ""}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">{formatListPrice(hideDiscount ? netRate : item.unitPrice, item.currency)}</td>
                {!hideDiscount ? <td className="num">{item.discountPct || 0}%</td> : null}
                <td className="num">{item.gstPct}%</td>
                <td className="num">{formatListPrice(item.lineAmount, item.currency)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          {packaging ? (
            <>
              <tr>
                <td colSpan={footerSpan} className="num">
                  Subtotal
                </td>
                <td className="num">{formatListPrice(itemsSubtotal, "INR")}</td>
              </tr>
              <tr>
                <td colSpan={footerSpan} className="num">
                  Packaging &amp; Forwarding
                </td>
                <td className="num">{formatListPrice(packaging, "INR")}</td>
              </tr>
            </>
          ) : null}
          <tr>
            <td colSpan={footerSpan} className="num">
              <strong>Total</strong>
            </td>
            <td className="num">
              <strong>{formatListPrice(quotation.grandTotal, "INR")}</strong>
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="invoice-words-row">
        <div>
          <strong>Amount Chargeable (in words)</strong>
          <br />
          INR {numberToWordsINR(quotation.grandTotal)} Only
        </div>
        <div className="invoice-eoe">E. &amp; O.E</div>
      </div>

      <table className="invoice-bank-table">
        <tbody>
          <tr>
            <td>
              <strong>Company&apos;s Bank Details</strong>
              <br />
              A/c Holder&apos;s Name : {COMPANY.bank.accountName}
              <br />
              Bank Name : {COMPANY.bank.bankName}
              <br />
              A/c No. : {COMPANY.bank.accountNo}
              <br />
              Branch &amp; IFS Code : {COMPANY.bank.branchIfsc}
            </td>
            <td className="invoice-signatory">
              <div>for {COMPANY.name}</div>
              <div className="invoice-signatory-space" />
              <div className="signatory-label">Authorised Signatory</div>
            </td>
          </tr>
        </tbody>
      </table>

      <p className="invoice-generated-note">This is a Computer Generated Document</p>
    </div>
  )
}

function partyBlock(label: string, party: Party) {
  return (
    <>
      <strong>{label}</strong>
      <br />
      {party.name}
      <br />
      Contact: {party.contact}
      {party.email ? (
        <>
          <br />
          Email: {party.email}
        </>
      ) : null}
      {party.address ? (
        <>
          <br />
          <span className="invoice-address-lines whitespace-pre-line">{party.address}</span>
        </>
      ) : null}
    </>
  )
}
