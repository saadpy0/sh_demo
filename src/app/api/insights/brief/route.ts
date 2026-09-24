import { askTheBooks, openaiConfigured, writeShopBrief } from "@/lib/insights/openai"

export const maxDuration = 60

type Body = {
  snapshot?: unknown
  question?: string
}

export async function POST(request: Request) {
  if (!openaiConfigured()) {
    return Response.json(
      { detail: "Add OPENAI_API_KEY to .env.local or .env, then restart the Next server." },
      { status: 503 }
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return Response.json({ detail: "Bad JSON" }, { status: 400 })
  }

  if (!body.snapshot || typeof body.snapshot !== "object") {
    return Response.json({ detail: "Missing snapshot" }, { status: 400 })
  }

  try {
    const question = body.question?.trim()
    if (question) {
      const answer = await askTheBooks(body.snapshot, question)
      return Response.json({ answer })
    }
    const brief = await writeShopBrief(body.snapshot)
    return Response.json(brief)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Brief failed"
    if (message === "missing_key") {
      return Response.json(
        { detail: "Add OPENAI_API_KEY to .env.local or .env, then restart the Next server." },
        { status: 503 }
      )
    }
    return Response.json({ detail: message }, { status: 502 })
  }
}
