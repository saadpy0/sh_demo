import { InsightsDesk } from "@/components/insights/insights-desk"
import { AppShell } from "@/components/crm/app-shell"

export default function InsightsPage() {
  return (
    <AppShell title="Insights">
      <InsightsDesk />
    </AppShell>
  )
}
