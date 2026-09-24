export type CatalogPrice = {
  id: number
  productId: number
  finish: string
  price: number | null
  currency: string
  confidence: string
  note: string | null
  sizeMm: string
  sizeInch: string
}

export type CatalogProduct = {
  id: number
  catalogId: number
  collectionId: number | null
  code: string
  itemName: string
  confidence: string
  reviewNotes: string | null
  sizeMm: string | null
  sizeInch: string | null
  colors: string[]
  category: string | null
  collection: string | null
  supplier: string
  catalog: string
  imageUrl: string | null
  prices: CatalogPrice[]
  minPrice: number | null
  maxPrice: number | null
}

export type SizeOption = {
  key: string
  label: string
  value: string
}

export type FilterOptions = {
  suppliers: string[]
  categories: string[]
  collections: string[]
  finishes: string[]
  sizes: SizeOption[]
}

export type SearchParams = {
  q?: string
  brands?: string[]
  category?: string
  collection?: string
  finish?: string
  size?: string
  limit?: number
  offset?: number
}

export type SearchResult = {
  total: number
  results: CatalogProduct[]
  query: string
  source: "supabase" | "seed"
}

export type CartItem = {
  productId: number | null
  code: string
  itemName: string
  collection: string | null
  supplier: string
  imageUrl: string | null
  finish: string
  exactFinish: string
  size: string | null
  color: string | null
  unitPrice: number | null
  currency: string
  quantity: number
  discountPct: number
  gstPct: number
}

export type Party = {
  name: string
  address: string
  contact: string
  email: string
}

export type QuotationSummary = {
  id: number
  voucherNo: string
  quotationDate: string
  shipToName: string
  billToName: string
  grandTotal: number
}

export type Quotation = {
  id: number
  voucherNo: string
  quotationDate: string
  hideDiscount: boolean
  packagingForwarding: number
  shipTo: Party
  billTo: Party
  items: Array<{
    productId: number | null
    code: string
    itemName: string
    collection: string | null
    supplier?: string
    imageUrl?: string | null
    finish: string
    exactFinish: string | null
    size: string | null
    color: string | null
    hsnSac: string | null
    unitPrice: number
    currency: string
    quantity: number
    discountPct: number
    gstPct: number
    lineAmount: number
  }>
  grandTotal: number
}

export type QuotationInput = {
  voucherNo: string
  hideDiscount: boolean
  packagingForwarding: number
  shipTo: Party
  billTo: Party
  items: CartItem[]
}
