import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.")
  process.exit(1)
}

const client = createClient(url, key, { auth: { persistSession: false } })
const { error, count } = await client.from("quotations").delete({ count: "exact" }).gte("id", 0)
if (error) {
  console.error(error.message)
  process.exit(1)
}
console.log(`Removed ${count ?? 0} saved quotes from Supabase. Next number will be SH-1001.`)
