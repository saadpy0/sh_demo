"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { FloorProvider } from "@/components/floor/floor-provider"
import { CrmProvider } from "@/lib/crm/store"
import { ThemeProvider } from "@/components/theme-provider"
import type { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light">
      <FloorProvider>
        <TooltipProvider>
          <CrmProvider>
            {children}
            <Toaster />
          </CrmProvider>
        </TooltipProvider>
      </FloorProvider>
    </ThemeProvider>
  )
}
