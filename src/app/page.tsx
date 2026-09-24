import { AppShell } from "@/components/crm/app-shell"
import { PipelineBoard } from "@/components/crm/pipeline-board"
import { StatStrip } from "@/components/crm/stat-strip"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function PipelinePage() {
  return (
    <AppShell
      title="Sales board"
      action={
        <Button nativeButton={false} render={<Link href="/leads/new" />}>
          New enquiry
        </Button>
      }
    >
      <StatStrip />
      <PipelineBoard />
    </AppShell>
  )
}
