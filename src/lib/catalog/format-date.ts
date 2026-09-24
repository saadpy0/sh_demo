export function formatQuotationDate(value: string) {
  const parsed = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
