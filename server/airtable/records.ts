export type AirtableRecord = {
  id: string
  createdTime?: string
  fields: Record<string, any>
}

export class AirtableReadError extends Error {
  constructor(public readonly code: string, public readonly httpStatus?: number) {
    super(httpStatus ? `Airtable request failed (HTTP ${httpStatus})` : `Airtable read failed (${code})`)
    this.name = "AirtableReadError"
  }
}

// Per-instance pacing only. A central queue is still required to coordinate different Vercel instances.
const readQueues = new Map<string, { tail: Promise<void>; startedAt: number }>()

async function paceRead(baseId: string, signal: AbortSignal) {
  let queue = readQueues.get(baseId)
  if (!queue) {
    queue = { tail: Promise.resolve(), startedAt: 0 }
    readQueues.set(baseId, queue)
  }
  const state = queue
  const turn = state.tail.catch(() => {}).then(async () => {
    signal.throwIfAborted()
    const wait = Math.max(0, 250 - (Date.now() - state.startedAt))
    if (wait) await new Promise(resolve => setTimeout(resolve, wait))
    signal.throwIfAborted()
    state.startedAt = Date.now()
  })
  state.tail = turn
  await turn
}

/** Read a complete table result or fail explicitly; never masquerade as an empty table. */
export async function readAirtableRecords(options: {
  baseId: string
  tableId: string
  token: string
  signal?: AbortSignal
  filterByFormula?: string
}): Promise<AirtableRecord[]> {
  if (!options.token || !options.baseId || !options.tableId) {
    throw new AirtableReadError("MISSING_CONFIGURATION")
  }
  const deadline = AbortSignal.timeout(25_000)
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline
  const records = new Map<string, AirtableRecord>()
  const offsets = new Set<string>()
  let offset: string | undefined

  do {
    signal.throwIfAborted()
    const url = new URL(`https://api.airtable.com/v0/${encodeURIComponent(options.baseId)}/${encodeURIComponent(options.tableId)}`)
    url.searchParams.set("pageSize", "100")
    if (offset) url.searchParams.set("offset", offset)
    if (options.filterByFormula) url.searchParams.set("filterByFormula", options.filterByFormula)
    await paceRead(options.baseId, signal)
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${options.token}` },
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    })
    if (!response.ok) throw new AirtableReadError("PROVIDER_ERROR", response.status)
    const page = await response.json()
    if (!page || !Array.isArray(page.records) ||
        (page.offset !== undefined && (typeof page.offset !== "string" || !page.offset))) {
      throw new AirtableReadError("INVALID_PAGE")
    }
    for (const record of page.records) {
      if (!record || typeof record.id !== "string" || !record.fields ||
          typeof record.fields !== "object" || Array.isArray(record.fields)) {
        throw new AirtableReadError("INVALID_RECORD")
      }
      records.set(record.id, record)
    }
    offset = page.offset
    if (offset) {
      if (offsets.has(offset)) throw new AirtableReadError("REPEATED_OFFSET")
      offsets.add(offset)
    }
  } while (offset)
  return [...records.values()]
}

/** Fetch one record's current fields. Airtable attachment URLs are signed and expire a
 * few hours after being generated, so callers publishing on a delay (e.g. the automation
 * runner) must re-fetch immediately before use rather than reuse an older snapshot. */
export async function readAirtableRecordById(options: {
  baseId: string
  tableId: string
  recordId: string
  token: string
  signal?: AbortSignal
}): Promise<AirtableRecord | null> {
  if (!options.token || !options.baseId || !options.tableId || !options.recordId) {
    throw new AirtableReadError("MISSING_CONFIGURATION")
  }
  const deadline = AbortSignal.timeout(15_000)
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline
  await paceRead(options.baseId, signal)
  const url = `https://api.airtable.com/v0/${encodeURIComponent(options.baseId)}/${encodeURIComponent(options.tableId)}/${encodeURIComponent(options.recordId)}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${options.token}` },
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  })
  if (response.status === 404) return null
  if (!response.ok) throw new AirtableReadError("PROVIDER_ERROR", response.status)
  const record = await response.json()
  if (!record || typeof record.id !== "string" || !record.fields || typeof record.fields !== "object") {
    throw new AirtableReadError("INVALID_RECORD")
  }
  return record
}
