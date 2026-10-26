import type { ContentEntry } from "@/lib/content"

export function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7)
}

export function monthsFromDays(days: Record<string, ContentEntry[]>): string[] {
  const months = new Set<string>()
  for (const iso of Object.keys(days)) months.add(monthKeyFromIso(iso))
  return [...months].sort()
}

export function latestMonth(months: string[]): string | null {
  if (months.length === 0) return null
  return [...months].sort()[months.length - 1]
}

/**
 * Choose the month to open after an import. Prefer the earliest month the
 * calendar has never seen; otherwise fall back to the latest imported month.
 * No month name is hard-coded.
 */
export function pickImportTargetMonth(
  importedMonths: string[],
  knownMonths: Iterable<string>,
): string | null {
  const sorted = [...new Set(importedMonths)].sort()
  if (sorted.length === 0) return null
  const known = new Set(knownMonths)
  return sorted.find((month) => !known.has(month)) ?? sorted[sorted.length - 1]
}

/**
 * Saved months are authoritative: remove every seed date in a saved month
 * before overlaying the snapshot, so an entry deleted from the workbook really
 * disappears. Months with no snapshot keep the seed.
 */
export function mergeCalendarDays(
  seedDays: Record<string, ContentEntry[]>,
  savedMonths: string[],
  savedDays: Record<string, ContentEntry[]>,
): Record<string, ContentEntry[]> {
  const saved = new Set(savedMonths)
  const merged: Record<string, ContentEntry[]> = {}
  for (const [iso, entries] of Object.entries(seedDays)) {
    if (!saved.has(monthKeyFromIso(iso))) merged[iso] = entries
  }
  for (const [iso, entries] of Object.entries(savedDays)) {
    merged[iso] = entries
  }
  return merged
}
