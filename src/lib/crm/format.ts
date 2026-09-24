export function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
}

export function shortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(iso))
}

export function longDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

export function dueLabel(iso: string) {
  const due = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDay = new Date(due)
  dueDay.setHours(0, 0, 0, 0)
  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}d late`
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  return shortDate(iso)
}

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

export function nextTicket(existing: string[]) {
  const nums = existing
    .map((ticket) => Number(ticket.split("-").at(-1)))
    .filter((n) => Number.isFinite(n))
  const next = (Math.max(0, ...nums) + 1).toString().padStart(4, "0")
  return `TH-2409-${next}`
}

export function nextQuoteNumber(existing: string[]) {
  const nums = existing
    .map((n) => Number(n.replace("Q-", "")))
    .filter((n) => Number.isFinite(n))
  const next = (Math.max(2400, ...nums) + 1).toString()
  return `Q-${next}`
}

export function nextAccountId(existing: string[]) {
  const nums = existing
    .map((id) => Number(id.replace("AC-", "")))
    .filter((n) => Number.isFinite(n))
  const next = (Math.max(100, ...nums) + 1).toString().padStart(3, "0")
  return `AC-${next}`
}

export function staffPhoto(seed: string) {
  return `https://picsum.photos/seed/${seed}/96/96`
}
