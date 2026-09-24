import { QuoteBuilder } from "@/components/catalog/quote-builder"
import { AppShell } from "@/components/crm/app-shell"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>
}) {
  const params = await searchParams
  const libraryHref = params.lead ? `/library?lead=${params.lead}` : "/library"
  return (
    <AppShell
      title="Quotes"
      action={
        <Button nativeButton={false} render={<Link href={libraryHref} />}>
          Catalogue
        </Button>
      }
    >
      <QuoteBuilder initialLeadId={params.lead} />
    </AppShell>
  )
}
