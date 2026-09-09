import {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  getAllConfiguredTables,
  TableTarget,
} from "@/lib/tables-config"

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

// Extract first media URL (image or video) from Airtable record fields
export function extractMediaFromRecord(
  fields: Record<string, any>,
  category: string
): { mediaUrl: string; mediaType: "image" | "video" } {
  let videoUrl = ""
  let imageUrl = ""

  for (const [key, val] of Object.entries(fields)) {
    if (!Array.isArray(val) || val.length === 0) continue

    for (const item of val) {
      if (item && typeof item === "object" && item.url) {
        const isVid =
          item.type?.startsWith("video/") ||
          item.filename?.toLowerCase().endsWith(".mp4") ||
          key.toLowerCase().includes("video") ||
          key.toLowerCase().includes("reel")

        if (isVid && !videoUrl) {
          videoUrl = item.url
        } else if (!isVid && !imageUrl) {
          imageUrl = item.url
        }
      }
    }
  }

  if (category === "Reels" && videoUrl) {
    return { mediaUrl: videoUrl, mediaType: "video" }
  }
  if (videoUrl) {
    return { mediaUrl: videoUrl, mediaType: "video" }
  }
  return { mediaUrl: imageUrl, mediaType: "image" }
}

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

  // Batch requests in chunks of 5 to strictly respect Airtable's 5 requests/second rate limit
  const BATCH_SIZE = 5
  for (let i = 0; i < tables.length; i += BATCH_SIZE) {
    const batch = tables.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (cfg) => {
        try {
          // Fetch both Scheduled and Posted records so calendar renders locked foreign keys accurately
          const formula = encodeURIComponent("OR(Status='Scheduled', Status='Posted')")
          const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${cfg.tableId}?filterByFormula=${formula}`
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
            cache: "no-store",
          })

          if (!res.ok) {
            const errBody = await res.text().catch(() => "")
            console.error(
              `⚠️ [Airtable Fetch Error] Table ${cfg.tableId} (${cfg.category} > ${cfg.idea}${cfg.fixtureType ? ` [${cfg.fixtureType}]` : ""}): HTTP ${res.status} - ${errBody}`
            )
            failedTables.push({
              tableId: cfg.tableId,
              category: cfg.category,
              idea: cfg.idea,
              status: res.status,
              error: errBody || `HTTP ${res.status}`,
            })
            return
          }

          const data = await res.json()
          for (const r of data.records || []) {
            const fields = r.fields || {}
            const dateVal =
              fields["Date and Time Scheduled"] ||
              fields["Date and Time"] ||
              fields["Date & Time"] ||
              fields["Date"]
            if (!dateVal) continue

            const pht = parsePhtDateAndTime(dateVal)
            if (!pht) continue

            const fkId =
              fields["Foreign Key ID"] ||
              fields["CID"] ||
              (fields["ID"] ? `CID-${fields["ID"]}` : r.id)

            // Extract item names
            const itemNames: string[] = []
            for (let idx = 1; idx <= 4; idx++) {
              const key = idx === 1 ? "Item Name" : `Item Name${idx}`
              if (fields[key]) itemNames.push(String(fields[key]))
            }

            const { mediaUrl, mediaType } = extractMediaFromRecord(fields, cfg.category)

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
          console.error(
            `⚠️ [Airtable Network Exception] Table ${cfg.tableId} (${cfg.category} > ${cfg.idea}):`,
            err?.message || err
          )
          failedTables.push({
            tableId: cfg.tableId,
            category: cfg.category,
            idea: cfg.idea,
            status: 0,
            error: err?.message || String(err),
          })
        }
      })
    )
  }

  if (failedTables.length > 0) {
    console.warn(`[Airtable Diagnostic] ${failedTables.length} out of ${tables.length} tables had fetch issues.`)
  }

  return { schedules: out, failedTables }
}

export async function syncAirtableRecord(
  tableId?: string,
  recordId?: string,
  status?: string,
  isoDate?: string,
  time?: string | null
) {
  if (!tableId || !recordId || !tableId.startsWith("tbl")) {
    throw new Error(`Invalid tableId (${tableId}) or recordId (${recordId})`)
  }

  const fieldsToUpdate: Record<string, any> = {}
  if (status) {
    fieldsToUpdate["Status"] = status === "Completed" ? "Complete" : status
  }
  if (isoDate) {
    const timePart = (time || "00:00").padStart(5, "0")
    // Explicit Philippine Time offset (+08:00) so Airtable stores the exact intended wall-clock time
    fieldsToUpdate["Date and Time Scheduled"] = `${isoDate}T${timePart}:00+08:00`
  } else if (status === "Completed" || status === "Complete") {
    // Clear scheduled dates when unscheduled
    fieldsToUpdate["Date and Time Scheduled"] = null
  }

  const patchRes = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: fieldsToUpdate }),
    }
  )

  if (!patchRes.ok) {
    const errText = await patchRes.text()
    console.warn(`Primary Airtable patch failed for table ${tableId}: ${patchRes.status} ${errText}`)

    // Fallback 1: If table uses "Completed" instead of "Complete"
    if (fieldsToUpdate["Status"] === "Complete") {
      const completedFields = { ...fieldsToUpdate, Status: "Completed" }
      const completedRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fields: completedFields }),
        }
      )
      if (completedRes.ok) return
    }

    // Fallback 2: Try alternative date column name 'Date and Time'
    if (fieldsToUpdate["Date and Time Scheduled"]) {
      const altDateFields: Record<string, any> = {
        ...fieldsToUpdate,
        "Date and Time": fieldsToUpdate["Date and Time Scheduled"],
      }
      delete altDateFields["Date and Time Scheduled"]
      const altDateRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fields: altDateFields }),
        }
      )
      if (altDateRes.ok) return
    }

    // Fallback 3: Status only if date field rejected
    const statusOnlyRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: { Status: status || "Scheduled" } }),
      }
    )

    if (!statusOnlyRes.ok) {
      const statusErr = await statusOnlyRes.text()
      throw new Error(`Airtable update failed: ${statusErr}`)
    }
  }
}
