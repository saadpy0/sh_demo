import { AppShell } from "@/components/crm/app-shell"
import { ClientDetail } from "@/components/crm/client-detail"

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <AppShell title="Customer">
      <ClientDetail id={id} />
    </AppShell>
  )
}
