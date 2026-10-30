import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { Fraunces, Manrope } from "next/font/google"
import { Suspense } from "react"
import { AppShell } from "@/components/app-shell"
import { FocusProvider } from "@/components/focus-provider"
import "./globals.css"

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
})

const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
})

export const metadata: Metadata = {
  title: {
    default: "Strategic Focus Tracker",
    template: "%s · Strategic Focus Tracker",
  },
  description:
    "Strategische und operative Zeit im Blick — für Geschäftsführerinnen und Geschäftsführer, die Gestaltungszeit schützen wollen.",
}

export const viewport: Viewport = {
  themeColor: "#162420",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Suspense fallback={<div className="min-h-dvh bg-background" />}>
          <FocusProvider>
            <AppShell>{children}</AppShell>
          </FocusProvider>
        </Suspense>
      </body>
    </html>
  )
}
