import { AppShell } from "@/components/crm/app-shell"
import { LibraryBrowser } from "@/components/catalog/library-browser"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>
}) {
  const params = await searchParams
  const quotesHref = params.lead ? `/quotes?lead=${params.lead}` : "/quotes"

  return (
    <AppShell
      title="Catalogue"
      action={
        <Button nativeButton={false} render={<Link href={quotesHref} />}>
          Quote
        </Button>
      }
    >
      <LibraryBrowser leadId={params.lead} />
    </AppShell>
  )
}
