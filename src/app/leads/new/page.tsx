import { AppShell } from "@/components/crm/app-shell"
import { LeadCaptureForm } from "@/components/crm/lead-capture-form"

export default function NewLeadPage() {
  return (
    <AppShell title="New enquiry">
      <LeadCaptureForm />
    </AppShell>
  )
}
