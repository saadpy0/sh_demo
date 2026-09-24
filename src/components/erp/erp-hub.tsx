"use client"

import { useFloor } from "@/components/floor/floor-provider"
import { Button } from "@/components/ui/button"
import { STAGE_LABEL } from "@/lib/crm/labels"
import { useCrm } from "@/lib/crm/store"
import { BooksIcon, ChartLineIcon, PlusIcon, ReceiptIcon } from "@phosphor-icons/react"
import Link from "next/link"
import type { ReactNode } from "react"

export function ErpHub() {
  const { phone } = useFloor()
  const crm = useCrm()

  const needQuote = crm.leads.filter((lead) => lead.stage === "new" || lead.stage === "contacted")
  const recentQuotes = [...crm.quotes]
    .sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime())
    .slice(0, 8)

  if (phone) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <BigJob href="/leads/new" icon={<PlusIcon className="size-7" weight="bold" />} label="New name" hint="Walk-in" />
          <BigJob href="/library" icon={<BooksIcon className="size-7" weight="bold" />} label="Find item" hint="Catalogue" />
          <BigJob href="/quotes" icon={<ReceiptIcon className="size-7" weight="bold" />} label="Make quote" hint="Prices" />
          <BigJob href="/insights" icon={<ChartLineIcon className="size-7" weight="bold" />} label="Insights" hint="Trends" />
        </div>

        <section>
          <h2 className="mb-2 text-base font-semibold">Need a quote</h2>
          {needQuote.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
              Nobody waiting. Tap New name.
            </p>
          ) : (
            <ul className="space-y-2">
              {needQuote.slice(0, 8).map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/library?lead=${lead.id}`}
                    className="flex min-h-[4.25rem] items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <span>
                      <span className="block text-base font-semibold leading-snug">{lead.company}</span>
                      <span className="text-sm text-muted-foreground">{lead.phone}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {STAGE_LABEL[lead.stage]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {recentQuotes.length > 0 ? (
          <section>
            <h2 className="mb-2 text-base font-semibold">Recent quotes</h2>
            <ul className="space-y-2">
              {recentQuotes.map((quote) => (
                <li key={quote.id}>
                  <Link
                    href="/quotes"
                    className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <span>
                      <span className="block font-mono text-sm">{quote.catalogVoucher || quote.number}</span>
                      <span className="text-sm text-muted-foreground">{quote.note}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ol className="grid gap-3 sm:grid-cols-3">
        <Step n="1" title="Write the enquiry" href="/leads/new" action="New enquiry">
          Walk-in or a message. Name, phone, who they are. Architect only if they sent the client.
        </Step>
        <Step n="2" title="Pick items" href="/library" action="Catalogue">
          Browse the catalogue and add lines to the customer’s cart.
        </Step>
        <Step n="3" title="Save the quote" href="/quotes" action="Quotes">
          Check prices and print a proforma. The quote stays linked to the enquiry.
        </Step>
      </ol>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Need a quote</h2>
            <Button type="button" size="sm" variant="outline" nativeButton={false} render={<Link href="/leads" />}>
              Enquiries
            </Button>
          </div>
          <ul className="mt-4 space-y-2">
            {needQuote.length === 0 ? (
              <li className="text-sm text-muted-foreground">Nobody waiting for a quote.</li>
            ) : (
              needQuote.slice(0, 8).map((lead) => (
                <li key={lead.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/library?lead=${lead.id}`} className="hover:underline">
                    {lead.company}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{STAGE_LABEL[lead.stage]}</span>
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Recent quotes</h2>
            <Button type="button" size="sm" variant="outline" nativeButton={false} render={<Link href="/quotes" />}>
              All quotes
            </Button>
          </div>
          <ul className="mt-4 space-y-2">
            {recentQuotes.length === 0 ? (
              <li className="text-sm text-muted-foreground">No quotes yet. Start from the catalogue.</li>
            ) : (
              recentQuotes.slice(0, 8).map((quote) => (
                <li key={quote.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-mono text-xs">{quote.catalogVoucher || quote.number}</span>
                    <span className="text-muted-foreground"> · {quote.note}</span>
                  </span>
                </li>
              ))
            )}
          </ul>
        </article>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/library" />}>
          Catalogue
        </Button>
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/insights" />}>
          Insights
        </Button>
        <Button size="sm" nativeButton={false} render={<Link href="/leads/new" />}>
          New enquiry
        </Button>
      </div>
    </div>
  )
}

function BigJob({
  href,
  icon,
  label,
  hint,
}: {
  href: string
  icon: ReactNode
  label: string
  hint: string
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[7.25rem] flex-col justify-between rounded-2xl bg-primary px-4 py-4 text-primary-foreground"
    >
      <span className="opacity-90">{icon}</span>
      <span>
        <span className="block text-lg font-semibold leading-tight">{label}</span>
        <span className="text-sm text-primary-foreground/75">{hint}</span>
      </span>
    </Link>
  )
}

function Step({
  n,
  title,
  href,
  action,
  children,
}: {
  n: string
  title: string
  href: string
  action: string
  children: ReactNode
}) {
  return (
    <li className="rounded-md border border-border bg-card p-4">
      <p className="font-mono text-xs text-muted-foreground">Step {n}</p>
      <h2 className="mt-1 text-sm font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
      <Button className="mt-4" size="sm" variant="outline" nativeButton={false} render={<Link href={href} />}>
        {action}
      </Button>
    </li>
  )
}
