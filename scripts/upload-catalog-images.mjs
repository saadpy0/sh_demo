import { createClient } from "@supabase/supabase-js"
import { readdirSync, readFileSync, statSync } from "fs"
import path from "path"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.")
  process.exit(1)
}

const BUCKET = "catalog"
const ROOT = path.join(process.cwd(), "public", "catalog")
const CONCURRENCY = 8

const supabase = createClient(url, key, { auth: { persistSession: false } })

function listJpgs(dir, prefix = "") {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = prefix ? `${prefix}/${name}` : name
    if (statSync(full).isDirectory()) out.push(...listJpgs(full, rel))
    else if (name.toLowerCase().endsWith(".jpg") || name.toLowerCase().endsWith(".jpeg") || name.toLowerCase().endsWith(".webp") || name.toLowerCase().endsWith(".png")) {
      out.push(rel)
    }
  }
  return out
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET)
  if (data) return
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: "8MB",
    allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  })
  if (error && !/already exists/i.test(error.message)) throw error
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase()
  if (ext === ".png") return "image/png"
  if (ext === ".webp") return "image/webp"
  return "image/jpeg"
}

async function uploadOne(rel) {
  const file = readFileSync(path.join(ROOT, rel))
  const { error } = await supabase.storage.from(BUCKET).upload(rel.replaceAll("\\", "/"), file, {
    contentType: mimeFor(rel),
    upsert: true,
    cacheControl: "31536000",
  })
  if (error) throw new Error(`${rel}: ${error.message}`)
}

const files = listJpgs(ROOT)
if (!files.length) {
  console.error(`No images found in ${ROOT}`)
  process.exit(1)
}

console.log(`Uploading ${files.length} catalog images to Storage bucket "${BUCKET}"…`)
await ensureBucket()

let done = 0
let next = 0
async function worker() {
  while (next < files.length) {
    const i = next++
    await uploadOne(files[i])
    done++
    if (done % 50 === 0 || done === files.length) {
      process.stdout.write(`  ${done}/${files.length}\r`)
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
console.log(`  ${files.length}/${files.length}`)
console.log("Done. Catalogue photos are public at:")
console.log(`  ${url.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/<brand>/<file>.jpg`)
