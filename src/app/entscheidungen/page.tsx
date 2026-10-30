import type { Metadata } from "next"
import { EntscheidungenView } from "@/components/entscheidungen/entscheidungen-view"

export const metadata: Metadata = {
  title: "Entscheidungen",
  description: "Entscheidungs-Hygiene: eine Nacht schlafen, Pro und Contra, ein Tagesbudget und eine kurze Nachlese.",
}

export default function Page() {
  return <EntscheidungenView />
}
