"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Clock, LayoutDashboard, Settings, Target } from "lucide-react"
import { DemoBanner } from "@/components/demo-banner"
import { useFocus } from "@/components/focus-provider"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Überblick", icon: LayoutDashboard },
  { href: "/zeit", label: "Zeiterfassung", icon: Clock },
  { href: "/fokus", label: "Fokus", icon: Target },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
] as const

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.35" />
      <path d="M16 6a10 10 0 0 1 10 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <Mark className={cn("size-8", light ? "text-white" : "text-strategic")} />
      <span>
        <span className={cn("block text-[11px] tracking-[0.18em]", light ? "text-white/55" : "text-muted-foreground")}>
          STRATEGIC FOCUS
        </span>
        <span className={cn("mt-1 block font-serif text-[1.65rem] leading-none", light ? "text-white" : "text-foreground")}>
          Tracker
        </span>
      </span>
    </span>
  )
}

function NavLinks({ pathname, onDark }: { pathname: string; onDark?: boolean }) {
  return (
    <ul className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.href
        const Icon = item.icon
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                onDark
                  ? active
                    ? "bg-white/15 text-white focus-visible:outline-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-white"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function LoadingState() {
  return (
    <div role="status" className="space-y-4">
      <p className="sr-only">Daten werden geladen.</p>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-muted" />
        <div className="h-72 rounded-3xl bg-card ring-1 ring-foreground/10" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-28 rounded-2xl bg-card ring-1 ring-foreground/10" />
          <div className="h-28 rounded-2xl bg-card ring-1 ring-foreground/10" />
          <div className="h-28 rounded-2xl bg-card ring-1 ring-foreground/10" />
        </div>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { ready, warning } = useFocus()

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:shadow"
      >
        Zum Inhalt
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-sidebar px-4 py-6 text-sidebar-foreground lg:flex">
        <Link
          href="/"
          className="rounded-xl px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Wordmark light />
        </Link>
        <nav className="mt-8" aria-label="Hauptnavigation">
          <NavLinks pathname={pathname} onDark />
        </nav>
        <p className="mt-auto px-3 text-xs leading-5 text-white/50">
          Daten bleiben in diesem Browser. Kein Konto, kein Server.
        </p>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <Wordmark />
          </Link>
        </header>
        <main id="inhalt" className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-12">
          {warning ? (
            <p role="alert" className="mb-4 rounded-2xl border border-lag/30 bg-[#f8ebe6] px-4 py-3 text-sm text-lag">
              {warning}
            </p>
          ) : null}
          {ready ? <DemoBanner /> : null}
          {ready ? children : <LoadingState />}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden"
        aria-label="Hauptnavigation"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                    active ? "text-strategic" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
