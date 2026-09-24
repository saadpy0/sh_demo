import { AppShell } from "@/components/crm/app-shell"
import { ClientList } from "@/components/crm/client-list"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function ClientsPage() {
  return (
    <AppShell
      title="Customers"
      action={
        <Button nativeButton={false} render={<Link href="/leads/new" />}>
          New enquiry
        </Button>
      }
    >
      <ClientList />
    </AppShell>
  )
}
