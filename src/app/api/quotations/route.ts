import { createQuotation, getQuotationByVoucher, listQuotationSummaries, listQuotations, nextVoucher } from "@/lib/catalog/repo"
import type { QuotationInput } from "@/lib/catalog/types"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("next") === "1") {
      return NextResponse.json({ voucherNo: await nextVoucher() })
    }
    const voucher = request.nextUrl.searchParams.get("voucher")?.trim()
    if (voucher) {
      const quotation = await getQuotationByVoucher(voucher)
      if (!quotation) {
        return NextResponse.json({ detail: "Quote not found in catalogue." }, { status: 404 })
      }
      return NextResponse.json(quotation)
    }
    const limitParam = request.nextUrl.searchParams.get("limit")
    if (limitParam) {
      const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 100)
      const offset = Math.max(Number(request.nextUrl.searchParams.get("offset")) || 0, 0)
      const page = await listQuotationSummaries(limit, offset)
      return NextResponse.json(page)
    }
    return NextResponse.json({ quotations: await listQuotations() })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load quotations"
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QuotationInput
    if (!body.shipTo?.name || !body.shipTo?.contact) {
      return NextResponse.json({ detail: "Ship-to name and phone are required." }, { status: 400 })
    }
    if (!body.items?.length) {
      return NextResponse.json({ detail: "Add at least one line." }, { status: 400 })
    }
    const quotation = await createQuotation(body)
    return NextResponse.json(quotation)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save quotation"
    return NextResponse.json({ detail: message }, { status: 400 })
  }
}
