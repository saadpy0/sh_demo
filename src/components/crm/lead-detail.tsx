"use client"

import { CrmQuoteList } from "@/components/crm/crm-quote-list"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { dueLabel, longDate } from "@/lib/crm/format"
import {
  architectLabel,
  isCompletedProject,
  isOpenEnquiry,
  LINE_LABEL,
  SOURCE_LABEL,
  STAGE_LABEL,
} from "@/lib/crm/labels"
import { addNote, closeEnquiry, useCrm } from "@/lib/crm/store"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

export function LeadDetail({ id }: { id: string }) {
  const { leads, activities, quotes, staff } = useCrm()
  const lead = leads.find((item) => item.id === id)
  const trail = activities.filter((item) => item.leadId === id)
  const leadQuotes = quotes.filter((item) => item.leadId === id)

  const [note, setNote] = useState("")

  if (!lead) {
    return (
      <p className="text-sm text-muted-foreground">
        This enquiry is not here. It may have been cleared when demo data was reset.
      </p>
    )
  }

  const ownerId = lead.ownerId

  function saveNote() {
    if (!note.trim()) return
    addNote(id, note.trim(), ownerId)
    setNote("")
    toast.success("Note saved")
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="space-y-5">
        <section className="rounded-md border border-border bg-card p-5">
          <p className="font-mono text-xs text-muted-foreground">{lead.ticket}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{lead.company}</h2>

          <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Item label="Stage" value={STAGE_LABEL[lead.stage]} />
            <Item label="Source" value={SOURCE_LABEL[lead.source]} />
            <Item label="Phone" value={lead.phone} />
            <Item label="Email" value={lead.email || "—"} breakWords />
            {lead.lines.length ? (
              <Item
                label="Product interest"
                value={lead.lines.map((line) => LINE_LABEL[line]).join(", ")}
                className="sm:col-span-2"
              />
            ) : null}
            {architectLabel(lead.architectName, lead.architectFirm) ? (
              <>
                <Item
                  label="Referral"
                  value={architectLabel(lead.architectName, lead.architectFirm)}
                  className="sm:col-span-2"
                />
                {lead.architectPhone ? <Item label="Referral phone" value={lead.architectPhone} /> : null}
                {lead.architectEmail ? (
                  <Item label="Referral email" value={lead.architectEmail} breakWords />
                ) : null}
              </>
            ) : null}
            <Item label="Logged" value={longDate(lead.createdAt)} />
            {lead.nextAction ? (
              <Item
                label="Next step"
                value={`${dueLabel(lead.nextAction.dueAt)} · ${lead.nextAction.note}`}
                className="sm:col-span-2"
              />
            ) : null}
          </dl>
          {isOpenEnquiry(lead.stage) ? (
            <Button
              type="button"
              className="mt-6"
              variant="outline"
              onClick={() => {
                closeEnquiry(lead.id)
                toast.success("Enquiry closed")
              }}
            >
              Close enquiry
            </Button>
          ) : null}
        </section>

        <section className="rounded-md border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Quotes</h3>
          {leadQuotes.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No quote yet.</p>
          ) : (
            <CrmQuoteList quotes={leadQuotes} closeLabel="Back to enquiry" />
          )}
          {!isOpenEnquiry(lead.stage) ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {isCompletedProject(lead.stage) ? (
                <>
                  This job is finished. See <Link href="/projects" className="underline">Completed</Link>.
                </>
              ) : (
                "This enquiry is closed."
              )}
            </p>
          ) : (
          <Button
            className="mt-3"
            size="sm"
            nativeButton={false}
            render={<Link href={`/library?lead=${lead.id}`} />}
          >
            {leadQuotes.length ? "Another quote" : "Make a quote"}
          </Button>
          )}
        </section>

      </div>

      <div className="space-y-5">
        <section className="rounded-md border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Add a note</h3>
          <Textarea
            className="mt-3"
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What happened on the call or at the counter"
          />
          <Button type="button" className="mt-3" onClick={saveNote}>
            Save note
          </Button>
        </section>

        <section className="rounded-md border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Activity</h3>
          <ol className="mt-4 space-y-4">
            {trail.map((item) => {
              const author = staff.find((person) => person.id === item.authorId)
              return (
                <li key={item.id} className="grid grid-cols-[12px_1fr] gap-3">
                  <span className="mt-1.5 size-2 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm leading-relaxed">{item.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {author?.name} · {longDate(item.at)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </div>
  )
}

function Item({
  label,
  value,
  breakWords,
  className,
}: {
  label: string
  value: string
  breakWords?: boolean
  className?: string
}) {
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-sm ${breakWords ? "break-all" : ""}`}>{value}</dd>
    </div>
  )
}
