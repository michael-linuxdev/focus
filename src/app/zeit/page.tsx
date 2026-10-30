import type { Metadata } from "next"
import { ZeitView } from "@/components/zeit/zeit-view"

export const metadata: Metadata = {
  title: "Zeiterfassung",
}

export default function Page() {
  return <ZeitView />
}
