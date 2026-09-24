import { AppShell } from "@/components/crm/app-shell"
import { ErpHub } from "@/components/erp/erp-hub"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function ErpPage() {
  return (
    <AppShell
      title="Home"
      action={
        <Button nativeButton={false} render={<Link href="/leads/new" />}>
          New enquiry
        </Button>
      }
    >
      <ErpHub />
    </AppShell>
  )
}
