import QRCode from "qrcode"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text")?.trim()
  if (!text) {
    return NextResponse.json({ detail: "Missing text query param" }, { status: 400 })
  }
  const size = Math.min(512, Math.max(96, Number(request.nextUrl.searchParams.get("size") || 160)))
  try {
    const png = await QRCode.toBuffer(text, {
      type: "png",
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    })
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    })
  } catch {
    return NextResponse.json({ detail: "Could not render QR" }, { status: 500 })
  }
}
