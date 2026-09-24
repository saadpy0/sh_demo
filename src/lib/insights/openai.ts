import type { ShopBrief, WatchItem } from "./types"

export type { ShopBrief, WatchItem }

export function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

function apiRoot() {
  const explicit = process.env.OPENAI_BASE_URL?.trim().replace(/\/$/, "")
  if (explicit) return explicit
  const key = process.env.OPENAI_API_KEY?.trim() || ""
  if (key.startsWith("sk-or-")) return "https://openrouter.ai/api/v1"
  return "https://api.openai.com/v1"
}

function modelName() {
  const set = process.env.OPENAI_MODEL?.trim()
  const root = apiRoot()
  if (set) {
    if (root.includes("openrouter.ai") && !set.includes("/")) return `openai/${set}`
    return set
  }
  return root.includes("openrouter.ai") ? "openai/gpt-4o-mini" : "gpt-4o-mini"
}

function parseJsonObject(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim()
  return JSON.parse(trimmed) as Record<string, unknown>
}

async function complete(system: string, user: string) {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) {
    const error = new Error("missing_key")
    throw error
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  }
  if (apiRoot().includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "http://localhost:3000"
    headers["X-Title"] = "Singapore Hardwares Insights"
  }

  const response = await fetch(`${apiRoot()}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelName(),
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })

  const payload = (await response.json()) as {
    error?: { message?: string }
    choices?: Array<{ message?: { content?: string } }>
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI ${response.status}`)
  }

  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error("Empty model reply")
  return parseJsonObject(content)
}

const BRIEF_SYSTEM = `You write a shop brief for Singapore Hardwares, a Chennai architectural-hardware counter (Aura, Decor Pulls Mortise, Laksh).
Use ONLY codes and numbers in the JSON snapshot. Do not invent SKUs, customers, or rupee figures.
Ranks in the snapshot are already exact — do not re-rank. Explain what they mean and what to do this week.
Tone: short, floor language, no marketing. Indian English is fine. Rupees already formatted in the numbers as integers.
Return JSON:
{
  "headline": "one sentence, max 22 words",
  "points": ["3 to 5 bullets, each one action or fact"],
  "watch": [{"code":"SKU","why":"why it matters","do":"what to do"}],
  "buy": "one sentence on what to restock or chase",
  "leave": "one sentence on what not to buy more of"
}
Watch list: 4 to 6 SKUs drawn from quotedNotSold, slowStock, stockouts, overBuy, underBuy, fallers. Prefer real codes from those lists.`

const ASK_SYSTEM = `You answer the owner from the same Insights snapshot. JSON only: { "answer": "..." }.
Stay inside the snapshot. If the question needs a number that is not there, say so. Two to six short sentences. Name SKUs when you cite them.`

export async function writeShopBrief(snapshot: unknown): Promise<ShopBrief> {
  const raw = await complete(BRIEF_SYSTEM, JSON.stringify(snapshot))
  const points = Array.isArray(raw.points) ? raw.points.map(String).filter(Boolean).slice(0, 6) : []
  const watchRaw = Array.isArray(raw.watch) ? raw.watch : []
  const watch: WatchItem[] = watchRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const row = item as Record<string, unknown>
      const code = String(row.code || "").trim()
      if (!code) return null
      return {
        code,
        why: String(row.why || "").trim(),
        do: String(row.do || "").trim(),
      }
    })
    .filter((item): item is WatchItem => Boolean(item))
    .slice(0, 6)

  return {
    headline: String(raw.headline || "The books are in.").slice(0, 180),
    points,
    watch,
    buy: String(raw.buy || "").slice(0, 280),
    leave: String(raw.leave || "").slice(0, 280),
  }
}

export async function askTheBooks(snapshot: unknown, question: string): Promise<string> {
  const raw = await complete(
    ASK_SYSTEM,
    JSON.stringify({ question: question.slice(0, 400), snapshot })
  )
  return String(raw.answer || "").trim() || "Nothing useful came back."
}
