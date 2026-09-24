import { AppShell } from "@/components/crm/app-shell"
import { LeadDetail } from "@/components/crm/lead-detail"

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <AppShell title="Enquiry">
      <LeadDetail id={id} />
    </AppShell>
  )
}
