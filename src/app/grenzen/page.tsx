import type { Metadata } from "next"
import { GrenzenView } from "@/components/grenzen/grenzen-view"

export const metadata: Metadata = {
  title: "Grenzen",
  description: "Grenzen und Energie: Abendritual, Nachrichtenfenster, Erholung und wie oft du Nein gesagt hast.",
}

export default function Page() {
  return <GrenzenView />
}
