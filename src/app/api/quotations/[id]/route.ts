import { getQuotation } from "@/lib/catalog/repo"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const quotation = await getQuotation(Number(id))
  if (!quotation) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 })
  }
  return NextResponse.json(quotation)
}
