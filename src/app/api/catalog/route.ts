import { catalogFilters, catalogSource, searchCatalog } from "@/lib/catalog/repo"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const brands = url.searchParams.getAll("brand").filter(Boolean)
  try {
    if (url.searchParams.get("meta") === "filters") {
      const data = await catalogFilters({
        brands,
        category: url.searchParams.get("category") || undefined,
        collection: url.searchParams.get("collection") || undefined,
      })
      return NextResponse.json({ ...data, source: catalogSource() })
    }
    const data = await searchCatalog({
      q: url.searchParams.get("q") || "",
      brands,
      category: url.searchParams.get("category") || undefined,
      collection: url.searchParams.get("collection") || undefined,
      finish: url.searchParams.get("finish") || undefined,
      size: url.searchParams.get("size") || undefined,
      limit: Number(url.searchParams.get("limit") || 40),
      offset: Number(url.searchParams.get("offset") || 0),
    })
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog query failed"
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
