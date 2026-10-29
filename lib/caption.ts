const CAPTION_PRIORITY_KEYS = [
  "caption generated",
  "generated caption",
  "caption",
] as const

function resolveFieldValue(val: unknown): string {
  if (typeof val === "string" && val.trim()) {
    return val.trim()
  }
  if (Array.isArray(val) && val.length > 0) {
    const first = val[0]
    if (typeof first === "string" && first.trim()) {
      return first.trim()
    }
  }
  return ""
}

/** Reads the Instagram caption from an Airtable record in strict priority order. */
export function extractCaption(fields: Record<string, any>): string {
  if (!fields || typeof fields !== "object") return ""

  const normalized = new Map<string, unknown>()
  for (const [k, v] of Object.entries(fields)) {
    normalized.set(k.trim().toLowerCase(), v)
  }

  for (const key of CAPTION_PRIORITY_KEYS) {
    const val = resolveFieldValue(normalized.get(key))
    if (val) return val
  }

  return ""
}


