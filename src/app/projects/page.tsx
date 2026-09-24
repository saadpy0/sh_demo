import { AppShell } from "@/components/crm/app-shell"
import { CompletedProjects } from "@/components/crm/completed-projects"

export default function ProjectsPage() {
  return (
    <AppShell title="Completed projects">
      <CompletedProjects />
    </AppShell>
  )
}
