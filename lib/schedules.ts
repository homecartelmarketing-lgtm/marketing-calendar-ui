import {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  getAllConfiguredTables,
  TableTarget,
} from "@/lib/tables-config"
import { extractOutputMedia as extractMediaFromRecord, deriveForeignKeyId } from "@/lib/output-media"
import { AirtableReadError, readAirtableRecords } from "@/server/airtable/records"

export type ScheduledEntry = {
  recordId: string
  tableId: string
  isoDate: string
  rowKey: string
  category: "Feeds" | "Reels" | "Stories"
  idea: string
  time: string | null
  fixture?: string
  foreignKeyId: string
  status: "Scheduled" | "Posted" | "Completed" | "Discard" | "For Manual"
  caption?: string
  airtableUrl?: string
  itemNames?: string[]
  mediaUrl?: string
  slides?: string[]
  mediaType?: "image" | "video"
  updatedAt: string
}

export type TableFetchError = {
  tableId: string
  category: string
  idea: string
  status: number
  error: string
}

// Convert UTC date into Philippine Standard Time (UTC+08:00) components
export function parsePhtDateAndTime(dateVal: string): { isoDate: string; time: string } | null {
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return null

    // Format strictly in Asia/Manila timezone (YYYY-MM-DD)
    const isoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)

    // Format time (HH:MM in 24h)
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d)

    return { isoDate, time }
  } catch {
    return null
  }
}

export { extractOutputMedia as extractMediaFromRecord } from "@/lib/output-media"

// Build map of locked foreign keys across all dates:
// foreignKeyId -> { isoDate, category, idea, fixture, status }
export function getLockedForeignKeys(schedules: Record<string, ScheduledEntry[]>) {
  const locked: Record<
    string,
    { isoDate: string; category: string; idea: string; fixture?: string; status: string }
  > = {}

  for (const [isoDate, entries] of Object.entries(schedules)) {
    for (const entry of entries) {
      if (entry.foreignKeyId && (entry.status === "Scheduled" || entry.status === "Posted")) {
        locked[entry.foreignKeyId] = {
          isoDate,
          category: entry.category,
          idea: entry.idea,
          fixture: entry.fixture,
          status: entry.status,
        }
      }
    }
  }
  return locked
}

export async function pullAirtableSchedules(): Promise<Record<string, ScheduledEntry[]>> {
  const { schedules } = await pullAirtableSchedulesWithDiagnostics()
  return schedules
}

export async function pullAirtableSchedulesWithDiagnostics(): Promise<{
  schedules: Record<string, ScheduledEntry[]>
  failedTables: TableFetchError[]
}> {
  const tables = getAllConfiguredTables()
  const out: Record<string, ScheduledEntry[]> = {}
  const failedTables: TableFetchError[] = []

  // Bound concurrent work; the shared reader paces every page per base within this instance.
  const BATCH_SIZE = 5
  for (let i = 0; i < tables.length; i += BATCH_SIZE) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 220))
    }
    const batch = tables.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (cfg) => {
        try {
          // Fetch both Scheduled and Posted records so calendar renders locked foreign keys accurately
          const records = await readAirtableRecords({
            baseId: AIRTABLE_BASE_ID,
            tableId: cfg.tableId,
            token: AIRTABLE_TOKEN,
            filterByFormula: "OR(Status='Scheduled', Status='Posted')",
          })
          for (const r of records) {
            const fields = r.fields || {}
            const dateVal =
              fields["Date and Time Scheduled"] ||
              fields["Date and Time"] ||
              fields["Date & Time"] ||
              fields["Date"]
            if (!dateVal) continue

            const pht = parsePhtDateAndTime(dateVal)
            if (!pht) continue

            const fkId = deriveForeignKeyId(fields, cfg.category, cfg.idea, cfg.fixtureType, r.id)

            // Extract item names
            const itemNames: string[] = []
            for (let idx = 1; idx <= 4; idx++) {
              const key = idx === 1 ? "Item Name" : `Item Name${idx}`
              if (fields[key]) itemNames.push(String(fields[key]))
            }

            const { mediaUrl, mediaType, slides } = extractMediaFromRecord(fields, cfg.category, cfg.idea)

            const rawStatus = fields["Status"] || "Scheduled"
            const status: ScheduledEntry["status"] =
              rawStatus === "Posted" ? "Posted" : "Scheduled"

            const entry: ScheduledEntry = {
              recordId: r.id,
              tableId: cfg.tableId,
              isoDate: pht.isoDate,
              rowKey: r.id, // Primary key is the immutable Airtable Record ID
              category: cfg.category,
              idea: cfg.idea,
              time: pht.time,
              fixture: cfg.fixtureType,
              foreignKeyId: fkId,
              status,
              caption: fields["Generated Caption"] || fields["Caption"] || "",
              airtableUrl: `https://airtable.com/${AIRTABLE_BASE_ID}/${cfg.tableId}/${r.id}`,
              itemNames: itemNames.length > 0 ? itemNames : undefined,
              mediaUrl: mediaUrl || undefined,
              slides: slides && slides.length > 0 ? slides : (mediaUrl ? [mediaUrl] : undefined),
              mediaType,
              updatedAt: new Date().toISOString(),
            }

            if (!out[pht.isoDate]) out[pht.isoDate] = []
            // Avoid duplicate record IDs on the same date
            if (!out[pht.isoDate].some((e) => e.recordId === r.id)) {
              out[pht.isoDate].push(entry)
            }
          }
        } catch (err: any) {
          failedTables.push({
            tableId: cfg.tableId,
            category: cfg.category,
            idea: cfg.idea,
            status: err instanceof AirtableReadError ? err.httpStatus || 0 : 0,
            error: err instanceof AirtableReadError ? err.code : "READ_FAILED",
          })
        }
      })
    )
  }

  return { schedules: out, failedTables }
}

export { syncAirtableRecord } from "@/server/airtable/write-schedule"
