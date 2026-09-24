import { AppShell } from "@/components/crm/app-shell"
import { LeadTable } from "@/components/crm/lead-table"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function LeadsPage() {
  return (
    <AppShell
      title="Enquiries"
      action={
        <Button nativeButton={false} render={<Link href="/leads/new" />}>
          New enquiry
        </Button>
      }
    >
      <LeadTable />
    </AppShell>
  )
}
