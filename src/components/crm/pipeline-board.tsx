"use client"

import { useFloor } from "@/components/floor/floor-provider"
import { LeadTicket } from "@/components/crm/lead-ticket"
import { BOARD_STAGES, STAGE_LABEL } from "@/lib/crm/labels"
import { money } from "@/lib/crm/format"
import { useCrm } from "@/lib/crm/store"
import { cn } from "@/lib/utils"

export function PipelineBoard() {
  const { leads } = useCrm()
  const { phone } = useFloor()

  return (
    <div className={cn(phone ? "flex flex-col gap-4" : "flex gap-3 overflow-x-auto pb-4")}>
      {BOARD_STAGES.map((stage) => {
        const column = leads.filter((lead) => lead.stage === stage)
        const total = column.reduce((sum, lead) => sum + lead.estimatedValue, 0)
        return (
          <section
            key={stage}
            className={cn(
              "flex flex-col rounded-md bg-muted/70 p-2",
              phone ? "w-full" : "w-[280px] shrink-0"
            )}
          >
            <header className="flex items-baseline justify-between px-1 py-2">
              <h2 className="text-sm font-semibold">
                {STAGE_LABEL[stage]}
                <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground">
                  {column.length}
                </span>
              </h2>
              <p className="font-mono text-[11px] text-muted-foreground">{money(total)}</p>
            </header>
            <div className="flex min-h-[120px] flex-col gap-2 p-0.5">
              {column.map((lead) => (
                <LeadTicket key={lead.id} lead={lead} />
              ))}
              {column.length === 0 ? (
                <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                  {stage === "quoted"
                    ? "Shows up when you save a quote"
                    : stage === "hold"
                      ? "Waiting after a quote is sent"
                      : stage === "won"
                        ? "Finished jobs land here"
                        : "Nothing here"}
                </p>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
