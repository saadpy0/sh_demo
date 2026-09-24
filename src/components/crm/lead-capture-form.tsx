"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFloor } from "@/components/floor/floor-provider"
import { CITIES, LINE_LABEL, SOURCE_LABEL } from "@/lib/crm/labels"
import { createLead, useCrm } from "@/lib/crm/store"
import type { LeadSource, ProductLine } from "@/lib/crm/types"
import { useRouter } from "next/navigation"
import { useState, type FormEvent, type ReactNode } from "react"
import { toast } from "sonner"

const LINES = Object.keys(LINE_LABEL) as ProductLine[]

export function LeadCaptureForm() {
  const router = useRouter()
  const { phone } = useFloor()
  const { staff } = useCrm()
  const [lines, setLines] = useState<ProductLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<LeadSource>("walk_in")
  const [referral, setReferral] = useState<"no" | "yes">("no")

  function toggleLine(line: ProductLine, checked: boolean) {
    setLines((current) =>
      checked ? [...current, line] : current.filter((item) => item !== line)
    )
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get("name") ?? "").trim()
    const phone = String(data.get("phone") ?? "").trim()
    const email = String(data.get("email") ?? "").trim()
    if (!name || !phone) {
      setError("Name and phone are required.")
      return
    }
    setError(null)

    const lead = createLead({
      company: name,
      contactName: name,
      contactRole: "",
      phone,
      whatsapp: phone,
      email,
      city: CITIES[0] ?? "Chennai",
      area: "",
      source,
      tradeType: "homeowner",
      lines,
      estimatedValue: 0,
      ownerId: staff[0]?.id ?? "",
      brief: "",
      architectName: referral === "yes" ? String(data.get("architectName") ?? "").trim() : "",
      architectFirm: referral === "yes" ? String(data.get("architectFirm") ?? "").trim() : "",
      architectPhone: referral === "yes" ? String(data.get("architectPhone") ?? "").trim() : "",
      architectEmail: referral === "yes" ? String(data.get("architectEmail") ?? "").trim() : "",
      nextAction: null,
    })
    toast.success(`${lead.ticket} saved`)
    router.push(`/leads/${lead.id}`)
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <FormSection title="Customer">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" className="sm:col-span-2">
            <Input id="name" name="name" autoComplete="name" placeholder={phone ? "Who is this?" : undefined} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98 765 43210"
            />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Referral">
        <Field label="Architect or interior designer referral" htmlFor="referral">
          <Select value={referral} onValueChange={(value) => value && setReferral(value as "no" | "yes")}>
            <SelectTrigger id="referral" className="w-full sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">No</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {referral === "yes" ? (
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <Field label="Architect name" htmlFor="architectName">
              <Input id="architectName" name="architectName" autoComplete="name" />
            </Field>
            <Field label="Firm" htmlFor="architectFirm">
              <Input id="architectFirm" name="architectFirm" autoComplete="organization" />
            </Field>
            <Field label="Phone" htmlFor="architectPhone">
              <Input id="architectPhone" name="architectPhone" inputMode="tel" autoComplete="tel" />
            </Field>
            <Field label="Email" htmlFor="architectEmail">
              <Input id="architectEmail" name="architectEmail" type="email" autoComplete="email" />
            </Field>
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Enquiry">
        <div className="grid gap-4">
          <Field label="Source" htmlFor="source">
            <Select value={source} onValueChange={(value) => setSource(value as LeadSource)}>
              <SelectTrigger id="source" className="w-full sm:max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SOURCE_LABEL) as LeadSource[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SOURCE_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        {phone ? null : (
          <div className="grid gap-2">
            <Label>Product interest</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LINES.map((line) => (
                <label
                  key={line}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={lines.includes(line)}
                    onCheckedChange={(value) => toggleLine(line, value === true)}
                  />
                  {LINE_LABEL[line]}
                </label>
              ))}
            </div>
          </div>
        )}
        </div>
      </FormSection>

      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        <Button type="submit" className="min-h-12 text-base">
          Save
        </Button>
        <Button type="button" variant="outline" className="min-h-12" onClick={() => router.push("/erp")}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-md border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string
  htmlFor: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
