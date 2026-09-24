import type { PeriodKey, PeriodRange } from "./types"

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function startOfQuarter(value: Date) {
  const month = Math.floor(value.getMonth() / 3) * 3
  return new Date(value.getFullYear(), month, 1)
}

function shiftRange(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime()
  const prevEnd = start
  const prevStart = new Date(prevEnd.getTime() - ms)
  return { prevStart, prevEnd }
}

export function resolvePeriod(
  key: PeriodKey,
  customStart?: string,
  customEnd?: string,
  now = new Date()
): PeriodRange {
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  let start = today
  let end = tomorrow
  let label = "Today"

  if (key === "7d") {
    start = addDays(tomorrow, -7)
    label = "Last 7 days"
  } else if (key === "30d") {
    start = addDays(tomorrow, -30)
    label = "Last 30 days"
  } else if (key === "month") {
    start = startOfMonth(today)
    label = "This month"
  } else if (key === "last_month") {
    end = startOfMonth(today)
    start = new Date(end.getFullYear(), end.getMonth() - 1, 1)
    label = "Last month"
  } else if (key === "quarter") {
    start = startOfQuarter(today)
    label = "This quarter"
  } else if (key === "year") {
    start = addDays(tomorrow, -365)
    label = "Last 12 months"
  } else if (key === "custom" && customStart && customEnd) {
    start = startOfDay(new Date(`${customStart}T00:00:00`))
    end = addDays(startOfDay(new Date(`${customEnd}T00:00:00`)), 1)
    label = "Custom"
  }

  const { prevStart, prevEnd } = shiftRange(start, end)
  return { key, label, start, end, prevStart, prevEnd }
}

export function inRange(iso: string, start: Date, end: Date) {
  const at = new Date(iso)
  return at >= start && at < end
}

export function periodDays(range: PeriodRange) {
  return Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86400000))
}

export const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "year", label: "Last 12 months" },
  { key: "custom", label: "Custom" },
]
