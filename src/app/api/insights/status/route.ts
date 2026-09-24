import { openaiConfigured } from "@/lib/insights/openai"

export async function GET() {
  return Response.json({ configured: openaiConfigured() })
}
