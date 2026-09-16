import { AIRTABLE_BASE_ID, AIRTABLE_TOKEN } from "@/lib/tables-config"

export class ScheduleValidationError extends Error {}

export function normalizePhtTime(time?: string | null): string {
  if (!time) return ""
  const trimmed = time.trim()
  const match = trimmed.match(/^(\d{1,2}):([0-5]\d)$/)
  if (!match) return trimmed
  const hour = Number(match[1])
  if (hour < 0 || hour > 23) return trimmed
  return `${String(hour).padStart(2, "0")}:${match[2]}`
}

export function phtScheduleTimestamp(isoDate?: string, time?: string | null): string {
  const effectiveTime = normalizePhtTime(time)
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !effectiveTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(effectiveTime)) {
    throw new ScheduleValidationError("A valid date and time (YYYY-MM-DD, HH:mm PHT) are required")
  }
  const day = new Date(`${isoDate}T00:00:00Z`)
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== isoDate) {
    throw new ScheduleValidationError("The scheduled calendar date does not exist")
  }
  return `${isoDate}T${effectiveTime}:00+08:00`
}

/** A successful schedule write must include its timestamp; never downgrade to status-only. */
export async function syncAirtableRecord(
  tableId?: string,
  recordId?: string,
  status?: string,
  isoDate?: string,
  time?: string | null,
): Promise<void> {
  if (!tableId || !/^tbl[a-zA-Z0-9]+$/.test(tableId) || !recordId || !/^rec[a-zA-Z0-9]+$/.test(recordId)) {
    throw new ScheduleValidationError("A valid Airtable table and record are required")
  }
  if (!status || !["Scheduled", "Posted", "Completed", "Complete", "For Manual", "Discard"].includes(status)) {
    throw new ScheduleValidationError("Unsupported content status")
  }

  const normalizedStatus = status === "Complete" ? "Completed" : status
  const clearDate = ["Completed", "For Manual", "Discard"].includes(normalizedStatus)
  const scheduledAt = !clearDate && (normalizedStatus === "Scheduled" || isoDate)
    ? phtScheduleTimestamp(isoDate, time)
    : undefined
  const statuses = normalizedStatus === "Completed" ? ["Completed", "Complete"] : [normalizedStatus]
  const dateFields = clearDate || scheduledAt ? ["Date and Time Scheduled", "Date and Time"] : [undefined]
  let lastStatus = 422

  for (const dateField of dateFields) {
    for (const candidateStatus of statuses) {
      const fields: Record<string, string | null> = { Status: candidateStatus }
      if (dateField) fields[dateField] = clearDate ? null : scheduledAt!
      const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
        signal: AbortSignal.timeout(10_000),
      })
      if (response.ok) return
      lastStatus = response.status
      if (response.status !== 422) break
      const body = await response.json().catch(() => null)
      const errorType = body?.error?.type
      if (errorType === "UNKNOWN_FIELD_NAME") break
      if (errorType !== "INVALID_MULTIPLE_CHOICE_OPTIONS") {
        throw new Error("Airtable rejected the schedule fields (HTTP 422). Verify the table schema.")
      }
    }
    if (lastStatus !== 422) break
  }
  throw new Error(`Airtable could not save the complete schedule change (HTTP ${lastStatus}). Verify permissions and date/status fields.`)
}
