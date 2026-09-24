"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react"
import { LS_UI_MODE_KEY, LS_UI_MODE_LEGACY } from "@/lib/brand"

export type UiMode = "desk" | "phone"

const KEY = LS_UI_MODE_KEY
const LEGACY_KEY = LS_UI_MODE_LEGACY
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((fn) => fn())
}

function apply(mode: UiMode) {
  if (typeof document === "undefined") return
  document.documentElement.dataset.floor = mode
}

function readStored(): UiMode | null {
  try {
    let value = localStorage.getItem(KEY)
    if (value !== "desk" && value !== "phone") {
      value = localStorage.getItem(LEGACY_KEY)
      if (value === "desk" || value === "phone") {
        localStorage.setItem(KEY, value)
        localStorage.removeItem(LEGACY_KEY)
      }
    }
    if (value === "desk" || value === "phone") return value
  } catch {
    /* ignore */
  }
  return null
}

function preferPhone() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(max-width: 768px)").matches
}

let mode: UiMode = "desk"

function hydrate() {
  const stored = readStored()
  mode = stored ?? (preferPhone() ? "phone" : "desk")
  apply(mode)
}

function persist(next: UiMode) {
  mode = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* ignore */
  }
  apply(next)
  emit()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

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
  const current = useSyncExternalStore(subscribe, () => mode, () => "desk" as UiMode)
  const overlayHostRef = useRef<HTMLDivElement | null>(null)
  const setMode = useCallback((next: UiMode) => persist(next), [])
  const toggle = useCallback(() => persist(mode === "phone" ? "desk" : "phone"), [])
  const value = useMemo(
    () => ({ mode: current, phone: current === "phone", setMode, toggle, overlayHostRef }),
    [current, setMode, toggle]
  )
  return <FloorContext.Provider value={value}>{children}</FloorContext.Provider>
}

export function useFloor() {
  return useContext(FloorContext)
}

if (typeof window !== "undefined") {
  hydrate()
}
