"use client"

import { Button } from "@/components/ui/button"
import { addToCart } from "@/lib/catalog/cart"
import { formatListPrice } from "@/lib/catalog/money"
import { DEFAULT_CURRENCY } from "@/lib/locale/india"
import { splitFinishGroup, splitSizeGroup } from "@/lib/catalog/split-options"
import type { CatalogPrice, CatalogProduct } from "@/lib/catalog/types"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type MatrixRow = {
  finish: string
  price: number | null
  currency: string
  note: string
  size: string
}

function matrixFrom(prices: CatalogPrice[]): MatrixRow[] {
  const rows: MatrixRow[] = []
  for (const price of prices) {
    const finishes = splitFinishGroup(price.finish)
    const sizeSource = price.sizeMm || price.sizeInch
    const sizes = sizeSource ? splitSizeGroup(sizeSource) : [""]
    for (const finish of finishes) {
      for (const size of sizes) {
        rows.push({
          finish,
          price: price.price,
          currency: price.currency,
          note: price.note || "",
          size,
        })
      }
    }
  }
  return rows
}

export function ProductCard({
  product,
  highlight = false,
  preset,
}: {
  product: CatalogProduct
  highlight?: boolean
  preset?: { finish?: string; size?: string; color?: string }
}) {
  const matrix = useMemo(() => matrixFrom(product.prices), [product.prices])
  const finishes = [...new Set(matrix.map((row) => row.finish).filter(Boolean))]
  const [finish, setFinish] = useState(preset?.finish && finishes.includes(preset.finish) ? preset.finish : finishes[0] || "")
  const sizes = matrix.filter((row) => !finish || row.finish === finish).map((row) => row.size)
  const uniqueSizes = [...new Set(sizes.filter(Boolean))]
  const [size, setSize] = useState(
    preset?.size && uniqueSizes.includes(preset.size) ? preset.size : uniqueSizes[0] || ""
  )
  const [color, setColor] = useState(
    preset?.color && product.colors.includes(preset.color) ? preset.color : product.colors[0] || ""
  )

  useEffect(() => {
    if (preset?.finish && finishes.includes(preset.finish)) setFinish(preset.finish)
    if (preset?.size) setSize(preset.size)
    if (preset?.color && product.colors.includes(preset.color)) setColor(preset.color)
    // Apply scanned variant once the card is on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, preset?.finish, preset?.size, preset?.color])

  const row =
    matrix.find((item) => item.finish === finish && (uniqueSizes.length ? item.size === size : true)) ||
    matrix[0]

  const sameCollection =
    product.collection &&
    product.category &&
    product.collection.trim().toLowerCase() === product.category.trim().toLowerCase()

  function add() {
    addToCart({
      productId: product.id,
      code: product.code,
      itemName: product.itemName,
      collection: product.collection,
      supplier: product.supplier,
      imageUrl: product.imageUrl,
      finish,
      exactFinish: finish,
      size: size || product.sizeMm || product.sizeInch,
      color: color || null,
      unitPrice: row?.price ?? null,
      currency: DEFAULT_CURRENCY,
      quantity: 1,
      discountPct: 0,
      gstPct: 18,
    })
    toast.success(`${product.code} added to quote`)
  }

  return (
    <article
      id={`product-${product.id}`}
      className={`flex flex-col rounded-md border bg-card p-4 ${
        highlight ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      {product.imageUrl ? (
        <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-md bg-muted/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.code}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{product.supplier}</p>
          <h3 className="mt-1 font-semibold leading-snug">{product.code}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{product.itemName}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {[product.category, sameCollection ? null : product.collection].filter(Boolean).join(" · ")}
        {product.sizeMm || product.sizeInch
          ? ` · ${[product.sizeMm, product.sizeInch].filter(Boolean).join(" / ")}`
          : ""}
      </p>

      <div className="mt-3 grid gap-2">
        {finishes.length > 0 ? (
          <label className="grid gap-1 text-xs">
            Finish
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={finish}
              onChange={(event) => {
                const next = event.target.value
                setFinish(next)
                const nextSizes = [
                  ...new Set(
                    matrix.filter((item) => item.finish === next).map((item) => item.size).filter(Boolean)
                  ),
                ]
                setSize(nextSizes[0] || "")
              }}
            >
              {finishes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {uniqueSizes.length > 0 ? (
          <label className="grid gap-1 text-xs">
            Size
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={size}
              onChange={(event) => setSize(event.target.value)}
            >
              {uniqueSizes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {product.colors.length > 0 ? (
          <label className="grid gap-1 text-xs">
            Colour
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            >
              {product.colors.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {row?.note || product.reviewNotes ? (
        <p className="mt-3 text-xs text-muted-foreground">{row?.note || product.reviewNotes}</p>
      ) : null}

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <p className="font-mono text-lg tabular-nums">
          {formatListPrice(row?.price ?? null, row?.currency)}
        </p>
        <Button type="button" size="sm" onClick={add}>
          Add to quote
        </Button>
      </div>
    </article>
  )
}
