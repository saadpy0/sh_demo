"use client"

import { CrmQuoteList } from "@/components/crm/crm-quote-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { dueLabel, longDate, money } from "@/lib/crm/format"
import {
  architectLabel,
  FOLLOW_UP_LABEL,
  isOpenEnquiry,
  SEGMENT_LABEL,
  TRADE_LABEL,
} from "@/lib/crm/labels"
import {
  addAccountNote,
  addFollowUp,
  completeFollowUp,
  updateAccount,
  useCrm,
} from "@/lib/crm/store"
import type { CustomerSegment, FollowUpKind } from "@/lib/crm/types"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

export function ClientDetail({ id }: { id: string }) {
  const { accounts, staff, leads, activities, quotes, followUps } = useCrm()
  const account = accounts.find((item) => item.id === id)
  const owner = staff.find((person) => person.id === account?.ownerId)
  const source = leads.find((lead) => lead.id === account?.sourceLeadId)
  const trail = activities.filter((item) => item.accountId === id || item.leadId === source?.id)
  const history = quotes.filter(
    (quote) => quote.accountId === id || (source && quote.leadId === source.id)
  )
  const accountFollowUps = useMemo(
    () => (followUps || []).filter((item) => item.accountId === id),
    [followUps, id]
  )

  const [note, setNote] = useState("")
  const [segment, setSegment] = useState<CustomerSegment | "">("")
  const [address, setAddress] = useState("")
  const [gstin, setGstin] = useState("")
  const [fuKind, setFuKind] = useState<FollowUpKind>("call")
  const [fuDue, setFuDue] = useState("")
  const [fuNote, setFuNote] = useState("")
  const [architectName, setArchitectName] = useState("")
  const [architectFirm, setArchitectFirm] = useState("")

  if (!account) {
    return <p className="text-sm text-muted-foreground">Account not found.</p>
  }

  const currentSegment = segment || account.segment
  const currentAddress = address || account.address
  const currentGstin = gstin || account.gstin
  const currentArchitectName = architectName || account.architectName
  const currentArchitectFirm = architectFirm || account.architectFirm

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-5">
        <section className="rounded-md border border-border bg-card p-5">
          <p className="font-mono text-xs text-muted-foreground">{account.id}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{account.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {account.contactName} · {SEGMENT_LABEL[account.segment]} · {TRADE_LABEL[account.tradeType]}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Tax number</dt>
              <dd className="font-mono">{account.gstin || "Not on file"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Opened</dt>
              <dd>{longDate(account.openedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd>{account.phone}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Looked after by</dt>
              <dd>{owner?.name}</dd>
            </div>
            {architectLabel(account.architectName, account.architectFirm) ? (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Referral</dt>
                <dd>{architectLabel(account.architectName, account.architectFirm)}</dd>
              </div>
            ) : null}
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Address</dt>
              <dd>{account.address || `${account.area}, ${account.city}`}</dd>
            </div>
          </dl>

          <p className="mt-5 max-w-[65ch] text-sm leading-relaxed">{account.notes}</p>

          {source ? (
            <p className="mt-5 text-sm">
              Opened from enquiry{" "}
              <Link href={`/leads/${source.id}`} className="font-mono underline">
                {source.ticket}
              </Link>
            </p>
          ) : null}
        </section>

        <section className="rounded-md border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Edit profile</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep tax number and address up to date.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="gstin">Tax number</Label>
              <Input
                id="gstin"
                value={currentGstin}
                onChange={(event) => setGstin(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="segment">Customer type</Label>
              <Select
                value={currentSegment}
                onValueChange={(value) => setSegment(value as CustomerSegment)}
              >
                <SelectTrigger id="segment" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SEGMENT_LABEL) as CustomerSegment[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SEGMENT_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="architectName">Architect name</Label>
              <Input
                id="architectName"
                value={currentArchitectName}
                onChange={(event) => setArchitectName(event.target.value)}
                placeholder="Name — leave empty if walk-in"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="architectFirm">Firm</Label>
              <Input
                id="architectFirm"
                value={currentArchitectFirm}
                onChange={(event) => setArchitectFirm(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                rows={2}
                value={currentAddress}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            className="mt-4"
            onClick={() => {
              updateAccount(id, {
                gstin: currentGstin.trim(),
                address: currentAddress.trim(),
                segment: currentSegment,
                architectName: currentArchitectName.trim(),
                architectFirm: currentArchitectFirm.trim(),
              })
              toast.success("Customer profile updated")
            }}
          >
            Save profile
          </Button>
        </section>

        <section className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Quote history</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/leads/new" />}>
                New enquiry
              </Button>
              {source && isOpenEnquiry(source.stage) ? (
                <Button size="sm" nativeButton={false} render={<Link href={`/library?lead=${source.id}`} />}>
                  New quote
                </Button>
              ) : null}
            </div>
          </div>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No quotes for this customer yet.</p>
          ) : (
            <CrmQuoteList quotes={history} closeLabel="Back to customer" />
          )}
        </section>
      </div>

      <div className="space-y-5">
        <section className="rounded-md border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Follow-ups</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Reminders to send a quote or chase a usual order.
          </p>
          <ul className="mt-4 space-y-3">
            {accountFollowUps.length === 0 ? (
              <li className="text-sm text-muted-foreground">No follow-ups logged.</li>
            ) : (
              accountFollowUps.map((item) => {
                const author = staff.find((person) => person.id === item.authorId)
                return (
                  <li
                    key={item.id}
                    className={`rounded-md border border-border px-3 py-3 ${item.doneAt ? "opacity-60" : ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{FOLLOW_UP_LABEL[item.kind]}</p>
                        <p className="mt-1 text-sm leading-relaxed">{item.note}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Due {dueLabel(item.dueAt)}
                          {item.doneAt ? ` · done ${longDate(item.doneAt)}` : ""}
                          {author ? ` · ${author.name}` : ""}
                        </p>
                      </div>
                      {!item.doneAt ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            completeFollowUp(item.id)
                            toast.success("Follow-up marked done")
                          }}
                        >
                          Done
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })
            )}
          </ul>

          <form
            className="mt-4 grid gap-3 border-t border-border pt-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!fuDue || !fuNote.trim()) {
                toast.error("Due date and note are required")
                return
              }
              addFollowUp({
                accountId: id,
                kind: fuKind,
                dueAt: new Date(fuDue).toISOString(),
                note: fuNote.trim(),
                authorId: account.ownerId,
              })
              setFuNote("")
              setFuDue("")
              toast.success("Follow-up scheduled")
            }}
          >
            <div className="grid gap-1.5 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="fu-kind">Type</Label>
                <Select value={fuKind} onValueChange={(value) => setFuKind(value as FollowUpKind)}>
                  <SelectTrigger id="fu-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FOLLOW_UP_LABEL) as FollowUpKind[])
                      .filter((key) => key !== "payment")
                      .map((key) => (
                      <SelectItem key={key} value={key}>
                        {FOLLOW_UP_LABEL[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fu-due">Due</Label>
                <Input
                  id="fu-due"
                  type="datetime-local"
                  value={fuDue}
                  onChange={(event) => setFuDue(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fu-note">Note</Label>
              <Textarea
                id="fu-note"
                rows={2}
                value={fuNote}
                onChange={(event) => setFuNote(event.target.value)}
                placeholder="What should the counter chase?"
              />
            </div>
            <Button type="submit" size="sm">
              Add follow-up
            </Button>
          </form>
        </section>

        <section className="rounded-md border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Notes &amp; activity</h3>
          <form
            className="mt-3 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (!note.trim()) return
              addAccountNote(id, note.trim(), account.ownerId)
              setNote("")
              toast.success("Note saved")
            }}
          >
            <Textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Call, visit, or counter note…"
            />
            <Button type="submit" size="sm" className="justify-self-start">
              Add note
            </Button>
          </form>
          <ol className="mt-4 space-y-4">
            {trail.length === 0 ? (
              <li className="text-sm text-muted-foreground">No activity yet.</li>
            ) : (
              trail.map((item) => {
                const author = staff.find((person) => person.id === item.authorId)
                return (
                  <li key={item.id}>
                    <p className="text-sm leading-relaxed">{item.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {author?.name} · {longDate(item.at)}
                    </p>
                  </li>
                )
              })
            )}
          </ol>
        </section>
      </div>
    </div>
  )
}
