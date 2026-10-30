import type { AppState } from "@/lib/types"

/**
 * Port für die Persistenz. Die Oberfläche hängt nur an dieser Schnittstelle.
 * Eine spätere API-Implementierung kann LocalStoragePersistence ersetzen,
 * ohne Auswertungen oder Seiten anzufassen.
 */
export interface FocusPersistence {
  read(): PersistenceRead
  write(state: AppState): PersistenceWrite
}

export type PersistenceRead =
  | { status: "empty" }
  | { status: "ok"; state: AppState }
  | { status: "invalid" }

export type PersistenceWrite = { ok: true } | { ok: false; message: string }
