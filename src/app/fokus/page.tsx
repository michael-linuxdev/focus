import type { Metadata } from "next"
import { FokusView } from "@/components/fokus/fokus-view"

export const metadata: Metadata = {
  title: "Fokus",
}

export default function Page() {
  return <FokusView />
}
