"use client"

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react"

export type UiMode = "desk" | "phone"

const FloorContext = createContext<{
  mode: UiMode
  phone: boolean
  setMode: (mode: UiMode) => void
  toggle: () => void
  overlayHostRef: RefObject<HTMLDivElement | null>
}>({
  mode: "desk",
  phone: false,
  setMode: () => {},
  toggle: () => {},
  overlayHostRef: { current: null },
})

export function FloorProvider({ children }: { children: ReactNode }) {
  const overlayHostRef = useRef<HTMLDivElement | null>(null)
  const value = useMemo(
    () => ({
      mode: "desk" as const,
      phone: false,
      setMode: () => {},
      toggle: () => {},
      overlayHostRef,
    }),
    []
  )
  return <FloorContext.Provider value={value}>{children}</FloorContext.Provider>
}

export function useFloor() {
  return useContext(FloorContext)
}
