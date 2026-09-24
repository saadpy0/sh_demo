"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ShopBrief } from "@/lib/insights/types"
import type { InsightSnapshot } from "@/lib/insights/snapshot"
import { SparkleIcon } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

function hashSnapshot(snapshot: InsightSnapshot) {
  const text = JSON.stringify(snapshot)
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return (h >>> 0).toString(16)
}

export function BriefDesk({ snapshot }: { snapshot: InsightSnapshot }) {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [brief, setBrief] = useState<ShopBrief | null>(null)
  const [busy, setBusy] = useState<"brief" | "ask" | null>(null)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<string | null>(null)
  const stamp = hashSnapshot(snapshot)

  useEffect(() => {
    fetch("/api/insights/status")
      .then((res) => res.json())
      .then((data: { configured?: boolean }) => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(false))
  }, [])

  useEffect(() => {
    setBrief(null)
    setAnswer(null)
  }, [stamp])

  async function writeBrief() {
    setBusy("brief")
    try {
      const res = await fetch("/api/insights/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      })
      const data = (await res.json()) as ShopBrief & { detail?: string }
      if (!res.ok) throw new Error(data.detail || "Brief failed")
      setBrief(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Brief failed")
    } finally {
      setBusy(null)
    }
  }

  async function ask(event: React.FormEvent) {
    event.preventDefault()
    const q = question.trim()
    if (!q) return
    setBusy("ask")
    try {
      const res = await fetch("/api/insights/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot, question: q }),
      })
      const data = (await res.json()) as { answer?: string; detail?: string }
      if (!res.ok) throw new Error(data.detail || "Ask failed")
      setAnswer(data.answer || "")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ask failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
        <div>
          <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            <SparkleIcon className="mr-1 inline size-3.5 align-[-2px]" />
            Shop brief
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Written from the tables on this cut. Rankings stay the app’s math.
          </p>
        </div>
        <Button type="button" size="sm" disabled={!configured || busy === "brief"} onClick={writeBrief}>
          {busy === "brief" ? "Reading the books…" : brief ? "Write again" : "Write the brief"}
        </Button>
      </div>

      <div className="space-y-4 p-4 md:p-5">
        {configured === false ? (
          <p className="text-sm text-muted-foreground">
            Add <code className="font-mono text-xs">OPENAI_API_KEY</code> to <code className="font-mono text-xs">.env.local</code>{" "}
            or <code className="font-mono text-xs">.env</code>, then restart the Next server.
          </p>
        ) : null}

        {configured && !brief ? (
          <p className="text-sm text-muted-foreground">
            Period and filters are already in the snapshot. Write the brief when you want a read on this cut.
          </p>
        ) : null}

        {brief ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-pretty">{brief.headline}</h2>
            <ul className="grid gap-2 md:grid-cols-2">
              {brief.points.map((point) => (
                <li
                  key={point}
                  className="rounded-xl bg-muted/70 px-3 py-2.5 text-sm leading-relaxed text-foreground"
                >
                  {point}
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-2">
              {brief.buy ? (
                <p className="rounded-xl border border-border px-3 py-2.5 text-sm">
                  <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Buy
                  </span>
                  {brief.buy}
                </p>
              ) : null}
              {brief.leave ? (
                <p className="rounded-xl border border-border px-3 py-2.5 text-sm">
                  <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Leave
                  </span>
                  {brief.leave}
                </p>
              ) : null}
            </div>
            {brief.watch.length ? (
              <div>
                <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Watch</p>
                <ul className="grid gap-2 md:grid-cols-2">
                  {brief.watch.map((item) => (
                    <li key={`${item.code}-${item.why}`} className="rounded-xl border border-border px-3 py-3">
                      <p className="font-mono text-sm font-medium">{item.code}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.why}</p>
                      {item.do ? <p className="mt-1 text-sm">{item.do}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {configured ? (
          <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask the books — e.g. what should we stop restocking?"
              className="sm:flex-1"
            />
            <Button type="submit" variant="outline" disabled={busy === "ask" || !question.trim()}>
              {busy === "ask" ? "Asking…" : "Ask"}
            </Button>
          </form>
        ) : null}

        {answer ? <p className="rounded-xl bg-muted/70 px-3 py-2.5 text-sm leading-relaxed">{answer}</p> : null}
      </div>
    </section>
  )
}
