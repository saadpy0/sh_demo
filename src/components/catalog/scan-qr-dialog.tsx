"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { LibraryScanHint } from "@/lib/catalog/resolve-library-scan"
import { resolveLibraryScan } from "@/lib/catalog/resolve-library-scan"
import jsQR from "jsqr"
import { useEffect, useRef, useState } from "react"

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
}

export function ScanQrDialog({
  open,
  onOpenChange,
  onScan,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (hint: LibraryScanHint) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onScanRef = useRef(onScan)
  const onOpenChangeRef = useRef(onOpenChange)
  const [status, setStatus] = useState("Starting camera…")
  const [manual, setManual] = useState("")
  const [busy, setBusy] = useState(false)
  onScanRef.current = onScan
  onOpenChangeRef.current = onOpenChange

  useEffect(() => {
    if (!open) return

    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    let locked = false
    let wait = 0

    function videoEl() {
      return videoRef.current
    }
    function canvasEl() {
      return canvasRef.current
    }
    let Detector: (new (opts?: { formats: string[] }) => BarcodeDetectorLike) | null = null
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      Detector = (window as unknown as { BarcodeDetector: new (opts?: { formats: string[] }) => BarcodeDetectorLike })
        .BarcodeDetector
    }
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null

    async function handleRaw(raw: string) {
      if (stopped || locked) return
      locked = true
      setBusy(true)
      try {
        const hint = await resolveLibraryScan(raw)
        stopped = true
        onScanRef.current(hint)
        onOpenChangeRef.current(false)
      } catch (err) {
        locked = false
        setBusy(false)
        setStatus(err instanceof Error ? err.message : "Could not read that code")
      }
    }

    async function tick() {
      const video = videoEl()
      const canvas = canvasEl()
      if (stopped || !video || !canvas || video.readyState < 2) {
        if (!stopped) raf = requestAnimationFrame(tick)
        return
      }
      try {
        if (detector) {
          const codes = await detector.detect(video)
          const value = codes[0]?.rawValue
          if (value) await handleRaw(value)
        } else {
          const ctx = canvas.getContext("2d", { willReadFrequently: true })
          if (ctx && video.videoWidth) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0)
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })
            if (code?.data) await handleRaw(code.data)
          }
        }
      } catch {
        /* keep scanning */
      }
      if (!stopped) raf = requestAnimationFrame(tick)
    }

    function begin() {
      const video = videoEl()
      if (!video) {
        if (wait++ < 30) raf = requestAnimationFrame(begin)
        return
      }
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
        .then((next) => {
          if (stopped) {
            next.getTracks().forEach((track) => track.stop())
            return
          }
          stream = next
          video.srcObject = next
          return video.play()
        })
        .then(() => {
          if (stopped) return
          setStatus("Point the camera at a product label")
          raf = requestAnimationFrame(tick)
        })
        .catch(() => {
          setStatus("Camera needs permission. You can paste a code below.")
        })
    }

    begin()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((track) => track.stop())
      const video = videoEl()
      if (video) video.srcObject = null
    }
  }, [open])

  async function submitManual(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const hint = await resolveLibraryScan(manual)
      onScan(hint)
      onOpenChange(false)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not read that code")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (next) {
          setStatus("Starting camera…")
          setManual("")
        }
      }}
    >
      <DialogContent className="bg-card sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Scan QR</DialogTitle>
          <DialogDescription>
            Stock labels open that item's card. You can also paste a code.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <p className="text-xs text-muted-foreground">{status}</p>
        <form onSubmit={submitManual} className="flex gap-2">
          <Input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="BTH-SKU:… or item code"
            className="flex-1"
          />
          <Button type="submit" variant="outline" disabled={busy || !manual.trim()}>
            Look up
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
