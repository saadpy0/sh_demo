"use client"

import { FloorToggle } from "@/components/floor/floor-toggle"
import { useFloor } from "@/components/floor/floor-provider"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  BooksIcon,
  ChartLineIcon,
  CheckCircleIcon,
  DotsThreeOutlineIcon,
  KanbanIcon,
  ListBulletsIcon,
  ListIcon,
  MoonIcon,
  PlusIcon,
  ReceiptIcon,
  SunIcon,
  HouseIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "@/components/theme-provider"
import { BRAND, FLOOR_PHONE_ID } from "@/lib/brand"
import { useState, type ReactNode } from "react"

const NAV_FLAT = [
  { href: "/erp", label: "Home", icon: HouseIcon },
  { href: "/insights", label: "Insights", icon: ChartLineIcon },
  { href: "/library", label: "Catalogue", icon: BooksIcon },
  { href: "/quotes", label: "Quotes", icon: ReceiptIcon },
  { href: "/", label: "Sales board", icon: KanbanIcon },
  { href: "/leads", label: "Enquiries", icon: ListBulletsIcon },
  { href: "/projects", label: "Completed", icon: CheckCircleIcon },
  { href: "/leads/new", label: "New enquiry", icon: PlusIcon },
  { href: "/clients", label: "Customers", icon: UsersThreeIcon },
] as const

const NAV_GROUPS: Array<{ heading: string; items: (typeof NAV_FLAT)[number][] }> = [
  { heading: "Shop", items: [...NAV_FLAT.slice(0, 4)] },
  { heading: "Customers", items: [...NAV_FLAT.slice(4)] },
]

const FLOOR_TABS = [
  { href: "/erp", label: "Home", icon: HouseIcon },
  { href: "/library", label: "Items", icon: BooksIcon },
  { href: "/quotes", label: "Quote", icon: ReceiptIcon },
  { href: "/insights", label: "Insights", icon: ChartLineIcon },
] as const

const FLOOR_MORE = NAV_FLAT.filter(
  (item) => !["/erp", "/library", "/quotes", "/insights"].includes(item.href)
)

function navActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  if (href === "/leads") {
    return pathname === "/leads" || (pathname.startsWith("/leads/") && !pathname.startsWith("/leads/new"))
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLinks({ onClick }: { onClick?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.heading}>
          <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/45">
            {group.heading}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = navActive(pathname, item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClick}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon weight={active ? "fill" : "regular"} className="size-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <Link href="/erp" className="flex items-start gap-3 px-1">
      <span className="mt-0.5 grid size-9 place-items-center rounded-md bg-primary font-mono text-[10px] font-semibold tracking-tight text-primary-foreground">
        {BRAND.monogram}
      </span>
      <span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/55">
          {BRAND.wordmark}
        </span>
        <span className="block text-base font-semibold leading-tight text-sidebar-foreground">
          Shop desk
        </span>
      </span>
    </Link>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light" : "Switch to dark"}
    >
      {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  )
}

function Rail() {
  return (
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center px-4">
        <Brand />
      </div>
      <div className="flex-1 px-3 py-2">
        <NavLinks />
      </div>
      <div className="space-y-3 px-4 py-4">
        <FloorToggle />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Priya Menon</p>
            <p className="text-xs text-sidebar-foreground/55">Chennai</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}

function PhoneShell({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname()
  const { overlayHostRef } = useFloor()
  const [more, setMore] = useState(false)
  const moreActive = FLOOR_MORE.some((item) => navActive(pathname, item.href))

  return (
    <div className="floor-stage">
      <div id={FLOOR_PHONE_ID} className="floor-phone">
        <header className="floor-top">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {BRAND.name}
              </p>
              <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
            </div>
            <FloorToggle compact />
          </div>
          {action ? <div className="floor-action">{action}</div> : null}
        </header>
        <main className="floor-body">{children}</main>
        <nav className="floor-dock" aria-label="Shop jobs">
          {FLOOR_TABS.map((item) => {
            const active =
              item.href === "/erp"
                ? pathname === "/erp"
                : navActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("floor-dock-item", active && "is-on")}
              >
                <Icon weight={active ? "fill" : "regular"} className="size-6" />
                {item.label}
              </Link>
            )
          })}
          <button
            type="button"
            className={cn("floor-dock-item", moreActive && "is-on")}
            onClick={() => setMore(true)}
          >
            <DotsThreeOutlineIcon weight={moreActive ? "fill" : "regular"} className="size-6" />
            More
          </button>
        </nav>
        <Sheet open={more} onOpenChange={setMore}>
          <SheetContent side="bottom" className="max-h-[80%] rounded-t-3xl px-4 pb-8">
            <SheetHeader className="pb-2 text-left">
              <SheetTitle className="text-xl">More</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2">
              {FLOOR_MORE.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMore(false)}
                    className="flex min-h-[4.5rem] flex-col justify-center gap-1 rounded-2xl border border-border bg-card px-3 py-3 text-sm font-semibold"
                  >
                    <Icon className="size-5 text-primary" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
        <div ref={overlayHostRef} className="floor-layer" />
      </div>
    </div>
  )
}

export function AppShell({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  const { phone } = useFloor()
  const [open, setOpen] = useState(false)

  if (phone) {
    return (
      <PhoneShell title={title} action={action}>
        {children}
      </PhoneShell>
    )
  }

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-border px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <ListIcon className="size-5" />
            </Button>
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden sm:block">
              <FloorToggle compact />
            </div>
            {action}
          </div>
        </header>
        <div className="px-4 pt-3 sm:hidden">
          <FloorToggle />
        </div>
        <main className="flex-1 px-4 py-5 lg:px-8 lg:py-6">{children}</main>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[232px] bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="h-16 justify-center px-4">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Brand />
          </SheetHeader>
          <div className="px-3 py-2">
            <NavLinks onClick={() => setOpen(false)} />
          </div>
          <div className="px-4 py-4">
            <FloorToggle />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
