"use client"

import { useFloor } from "@/components/floor/floor-provider"
import { cn } from "@/lib/utils"
import { DeviceMobileIcon, DesktopIcon } from "@phosphor-icons/react"

export function FloorToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useFloor()
  return (
    <div
      role="group"
      aria-label="Desk or phone"
      className={cn(
        "grid grid-cols-2 rounded-xl border border-border bg-muted p-1",
        compact ? "w-[168px]" : "w-full"
      )}
    >
      <button
        type="button"
        aria-pressed={mode === "desk"}
        onClick={() => setMode("desk")}
        className={cn(
          "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-sm font-semibold",
          mode === "desk" ? "bg-card text-foreground" : "text-muted-foreground"
        )}
      >
        <DesktopIcon className="size-4" weight={mode === "desk" ? "fill" : "regular"} />
        Desk
      </button>
      <button
        type="button"
        aria-pressed={mode === "phone"}
        onClick={() => setMode("phone")}
        className={cn(
          "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-sm font-semibold",
          mode === "phone" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        )}
      >
        <DeviceMobileIcon className="size-4" weight={mode === "phone" ? "fill" : "regular"} />
        Phone
      </button>
    </div>
  )
}
