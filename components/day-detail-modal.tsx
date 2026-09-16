"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, RefreshCw, X } from "lucide-react"
import {
  CONTENT_TYPES,
  FIXTURES,
  formatLongDate,
  isRealIdea,
  type ContentEntry,
  type ContentType,
} from "@/lib/content"
import { ContentPreviewModal, type PreviewItem } from "@/components/content-preview-modal"
import type { OutputItem } from "@/app/api/content-outputs/route"
import type { ScheduledEntry } from "@/app/api/schedules/route"

type RowStyle = { label: string; cell: string; empty: string }

const TYPE_STYLES: Record<ContentType, RowStyle> = {
  Feeds: {
    label: "border-blue-300 bg-blue-50 text-blue-600",
    cell: "border-blue-300 bg-blue-50 text-blue-600",
    empty: "border-red-300 bg-red-50 text-red-500",
  },
  Reels: {
    label: "border-orange-300 bg-orange-50 text-orange-500",
    cell: "border-orange-300 bg-orange-50 text-orange-500",
    empty: "border-red-300 bg-red-50 text-red-500",
  },
  Stories: {
    label: "border-green-400 bg-green-50 text-green-600",
    cell: "border-green-400 bg-green-50 text-green-600",
    empty: "border-red-300 bg-red-50 text-red-500",
  },
}

type FlatRow = {
  key: string
  type: ContentType
  entry: ContentEntry | null
  isFirstOfType: boolean
  typeRowCount: number
}

type SelectionState = {
  fixture?: string
  cid?: string
  outputItem?: OutputItem
}

function normalizeIdea(str?: string | null): string {
  if (!str) return ""
  return str.toLowerCase().replace(/story|feed|reel|layout|photo|styled|#|\s+/g, "")
}

function buildSelectionsFromSchedules(
  schedules: ScheduledEntry[],
  currentRows: FlatRow[]
): Record<string, SelectionState> {
  const init: Record<string, SelectionState> = {}
  if (!schedules || schedules.length === 0) return init

  const claimed = new Set<string>()

  for (const r of currentRows) {
    if (!r.entry) continue

    const matched = schedules.find((s) => {
      if (claimed.has(s.recordId)) return false
      if (r.entry?.cid && s.foreignKeyId === r.entry.cid) return true
      if (
        r.entry?.fixture &&
        s.fixture &&
        matchesFixture(s.fixture, r.entry.fixture) &&
        s.category === r.type &&
        normalizeIdea(s.idea) === normalizeIdea(r.entry?.idea)
      ) {
        return true
      }
      if (
        !r.entry?.fixture &&
        !r.entry?.cid &&
        s.category === r.type &&
        normalizeIdea(s.idea) === normalizeIdea(r.entry?.idea)
      ) {
        return true
      }
      if (s.rowKey === r.key || s.recordId === r.key) return true
      return false
    })

    if (matched) {
      claimed.add(matched.recordId)
      init[r.key] = {
        fixture: matched.fixture,
        cid: matched.foreignKeyId,
        outputItem: {
          recordId: matched.recordId,
          tableId: matched.tableId,
          category: matched.category,
          contentType: matched.idea,
          foreignKeyId: matched.foreignKeyId,
          status: matched.status,
          rawStatus: matched.status,
          date: matched.isoDate,
          time: matched.time || "",
          mediaType: matched.mediaType || "image",
          slides: matched.slides && matched.slides.length > 0 ? matched.slides : (matched.mediaUrl ? [matched.mediaUrl] : []),
          caption: matched.caption || "",
          airtableUrl: matched.airtableUrl || "",
          itemNames: matched.itemNames || [],
          fixtureType: matched.fixture,
        },
      }
    }
  }

  return init
}

export function DayDetailModal({
  iso,
  entries,
  onClose,
  lockedForeignKeys = {},
  existingSchedules = [],
  onScheduleSaved,
}: {
  iso: string
  entries: ContentEntry[]
  onClose: () => void
  lockedForeignKeys?: Record<string, { isoDate: string; category: string; idea: string; fixture?: string; status: string }>
  existingSchedules?: ScheduledEntry[]
  onScheduleSaved?: (entry: ScheduledEntry) => void
}) {
  // Build one row per entry, grouping by content type. Also dynamically incorporate extra scheduled records.
  const rows = useMemo<FlatRow[]>(() => {
    const out: FlatRow[] = []
    for (const type of CONTENT_TYPES) {
      const ofType = entries.filter((e) => e.type === type)
      const schedOfType = (existingSchedules || []).filter((s) => s.category === type)

      const claimedSchedIds = new Set<string>()
      const rowList: { key: string; entry: ContentEntry }[] = []

      if (ofType.length === 0 && schedOfType.length === 0) {
        out.push({ key: `${type}-empty`, type, entry: null, isFirstOfType: true, typeRowCount: 1 })
        continue
      }

      ofType.forEach((entry, i) => {
        const matched = schedOfType.find((s) => {
          if (claimedSchedIds.has(s.recordId)) return false
          if (
            entry.fixture &&
            s.fixture &&
            matchesFixture(s.fixture, entry.fixture) &&
            normalizeIdea(s.idea) === normalizeIdea(entry.idea)
          ) {
            return true
          }
          if (
            !entry.fixture &&
            !entry.cid &&
            normalizeIdea(s.idea) === normalizeIdea(entry.idea)
          ) {
            return true
          }
          return false
        })
        if (matched) claimedSchedIds.add(matched.recordId)

        rowList.push({
          key: `${type}-${i}`,
          entry: {
            ...entry,
            status: matched?.status || entry.status,
            cid: matched?.foreignKeyId || entry.cid,
            fixture: matched?.fixture || entry.fixture,
            time: matched?.time || entry.time,
          },
        })
      })

      // Append any extra scheduled items for this category not already represented
      schedOfType.forEach((sched) => {
        if (!claimedSchedIds.has(sched.recordId)) {
          claimedSchedIds.add(sched.recordId)
          rowList.push({
            key: `${type}-${sched.recordId}`,
            entry: {
              type,
              idea: sched.idea,
              time: sched.time,
              status: sched.status,
              fixture: sched.fixture,
              cid: sched.foreignKeyId,
            },
          })
        }
      })

      rowList.forEach((r, i) => {
        out.push({
          key: r.key,
          type,
          entry: r.entry,
          isFirstOfType: i === 0,
          typeRowCount: rowList.length,
        })
      })
    }
    return out
  }, [entries, existingSchedules])

  const userModifiedKeys = useRef<Set<string>>(new Set())

  const [selections, setSelections] = useState<Record<string, SelectionState>>(() => {
    return buildSelectionsFromSchedules(existingSchedules, [])
  })

  // Reactive effect: whenever existingSchedules or rows update, re-sync selections unless modified by user
  useEffect(() => {
    if (existingSchedules && existingSchedules.length > 0) {
      const fromSchedules = buildSelectionsFromSchedules(existingSchedules, rows)
      setSelections((prev) => {
        const next = { ...prev }
        for (const [k, v] of Object.entries(fromSchedules)) {
          if (!userModifiedKeys.current.has(k)) {
            next[k] = v
          }
        }
        return next
      })
    }
  }, [existingSchedules, rows])

  const [openDropdown, setOpenDropdown] = useState<{ key: string; kind: "fixture" | "cid" } | null>(null)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [outputsMap, setOutputsMap] = useState<Record<string, OutputItem[]>>({})
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const [refreshing, setRefreshing] = useState(false)

  const refreshOutputs = async () => {
    setRefreshing(true)
    const pairs = new Set<string>()
    entries.forEach((e) => {
      if (e && isRealIdea(e.idea)) {
        pairs.add(`${e.type}::${e.idea}`)
      }
    })

    const fetchPromises = Array.from(pairs).map(async (pair) => {
      const [category, type] = pair.split("::")
      setLoadingMap((prev) => ({ ...prev, [pair]: true }))
      try {
        const res = await fetch(
          `/api/content-outputs?category=${encodeURIComponent(category)}&type=${encodeURIComponent(type)}&_t=${Date.now()}`
        )
        if (res.ok) {
          const data = await res.json()
          const items: OutputItem[] = data.items || []
          setOutputsMap((prev) => ({ ...prev, [pair]: items }))
        }
      } catch (err) {
        console.error(`Failed to load outputs for ${pair}:`, err)
      } finally {
        setLoadingMap((prev) => ({ ...prev, [pair]: false }))
      }
    })

    await Promise.all(fetchPromises)
    setRefreshing(false)
  }

  // Fetch outputs for all distinct (category, idea) pairs present in entries
  useEffect(() => {
    const pairs = new Set<string>()
    entries.forEach((e) => {
      if (e && isRealIdea(e.idea)) {
        pairs.add(`${e.type}::${e.idea}`)
      }
    })

    pairs.forEach(async (pair) => {
      if (outputsMap[pair] || loadingMap[pair]) return
      const [category, type] = pair.split("::")

      setLoadingMap((prev) => ({ ...prev, [pair]: true }))
      try {
        const res = await fetch(
          `/api/content-outputs?category=${encodeURIComponent(category)}&type=${encodeURIComponent(type)}&_t=${Date.now()}`
        )
        if (res.ok) {
          const data = await res.json()
          const items: OutputItem[] = data.items || []
          setOutputsMap((prev) => ({ ...prev, [pair]: items }))
        }
      } catch (err) {
        console.error(`Failed to load outputs for ${pair}:`, err)
      } finally {
        setLoadingMap((prev) => ({ ...prev, [pair]: false }))
      }
    })
  }, [entries, outputsMap, loadingMap])

  // Auto-select first available Fixture and CID if the row does not have a fixture yet
  useEffect(() => {
    setSelections((prev) => {
      let changed = false
      const next = { ...prev }

      for (const r of rows) {
        if (!r.entry || !isRealIdea(r.entry.idea)) continue
        if (userModifiedKeys.current.has(r.key)) continue

        const curSel = next[r.key] ?? {}
        const curFixture = curSel.fixture ?? r.entry.fixture
        const curCid = curSel.cid ?? r.entry.cid

        if (!curFixture || !curCid) {
          const pairKey = `${r.type}::${r.entry.idea}`
          const items = outputsMap[pairKey] || []
            const isEntryPosted = Boolean(r.entry.status?.toLowerCase().includes("post"))
            const validItems = items.filter(
              (it) => it.status !== "For Manual" && it.status !== "Discard"
            )
            const completedItems = validItems.filter((it) => it.status === "Completed")
            const postedItems = validItems.filter((it) => it.status === "Posted")

            // If calendar entry is marked 'Posted', prioritize posted items; otherwise prioritize completed items
            const pool = isEntryPosted
              ? (postedItems.length > 0 ? postedItems : completedItems)
              : (completedItems.length > 0 ? completedItems : postedItems)

            if (pool.length > 0) {
              const candidate = curFixture
                ? pool.find((it) => matchesFixture(it.fixtureType, curFixture))
                : pool[0]

              if (candidate) {
                const newFixture = curFixture || candidate.fixtureType || undefined
                const newCid = curCid || candidate.foreignKeyId

                if (newFixture !== curSel.fixture || newCid !== curSel.cid) {
                  next[r.key] = {
                    ...curSel,
                    fixture: newFixture,
                    cid: newCid,
                    outputItem: candidate,
                  }
                  changed = true
                }
              }
            }
          }
        }

      return changed ? next : prev
    })
  }, [outputsMap, rows])

  // Ordered list of real (non-N/A) rows that can be previewed, with the
  // fixture/CID selections and full outputItem resolved.
  const previewItems = useMemo<PreviewItem[]>(() => {
    return rows
      .filter((r) => r.entry && isRealIdea(r.entry.idea))
      .map((r) => {
        const sel = selections[r.key] ?? {}
        const pairKey = `${r.type}::${r.entry!.idea}`
        const items = outputsMap[pairKey] || []
        const currentCid = sel.cid ?? r.entry!.cid
        const matchedItem = sel.outputItem ?? items.find((it) => it.foreignKeyId === currentCid)

        return {
          key: r.key,
          type: r.type,
          idea: r.entry!.idea,
          time: r.entry!.time,
          fixture: sel.fixture ?? matchedItem?.fixtureType ?? r.entry!.fixture,
          cid: currentCid,
          outputItem: matchedItem,
          isoDate: iso,
        }
      })
  }, [rows, selections, outputsMap, iso])

  const openPreview = (key: string) => {
    const idx = previewItems.findIndex((p) => p.key === key)
    if (idx >= 0) setPreviewIndex(idx)
  }

  const handleScheduleSuccess = (key: string, status: string, fullEntry?: ScheduledEntry) => {
    userModifiedKeys.current.add(key)
    if (status === "For Manual" || status === "Discard") {
      setSelections((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          cid: "",
          outputItem: undefined,
        },
      }))
      refreshOutputs()
      return
    }

    setSelections((prev) => {
      const existing = prev[key] ?? {}
      return {
        ...prev,
        [key]: {
          ...existing,
          fixture: fullEntry?.fixture || existing.fixture,
          cid: fullEntry?.foreignKeyId || existing.cid,
          outputItem: fullEntry
            ? {
                recordId: fullEntry.recordId,
                tableId: fullEntry.tableId,
                category: fullEntry.category,
                contentType: fullEntry.idea,
                foreignKeyId: fullEntry.foreignKeyId,
                status: fullEntry.status,
                rawStatus: fullEntry.status,
                date: fullEntry.isoDate,
                time: fullEntry.time || "",
                mediaType: fullEntry.mediaType || "image",
                slides: fullEntry.slides && fullEntry.slides.length > 0 ? fullEntry.slides : (fullEntry.mediaUrl ? [fullEntry.mediaUrl] : (existing.outputItem?.slides || [])),
                caption: fullEntry.caption || existing.outputItem?.caption || "",
                airtableUrl: fullEntry.airtableUrl || existing.outputItem?.airtableUrl || "",
                itemNames: fullEntry.itemNames || existing.outputItem?.itemNames || [],
                fixtureType: fullEntry.fixture || existing.outputItem?.fixtureType,
              }
            : existing.outputItem
            ? { ...existing.outputItem, status: status as any }
            : undefined,
        },
      }
    })
    if (fullEntry && onScheduleSaved) {
      onScheduleSaved(fullEntry)
    }
    refreshOutputs()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Content for ${formatLongDate(iso)}`}
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-black p-3 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={refreshOutputs}
            disabled={refreshing}
            title="Refresh and sync latest Airtable records"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Syncing Airtable..." : "Refresh Airtable"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-black transition-opacity hover:opacity-80"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="rounded-xl bg-white p-2 sm:p-4">
          <div className="mb-4 rounded-xl border-2 border-neutral-300 py-3 text-center sm:py-4">
            <span className="text-lg font-semibold text-black sm:text-2xl">{formatLongDate(iso)}</span>
          </div>

          <div className="flex flex-col gap-2">
            {CONTENT_TYPES.map((type) => (
              <TypeGroup
                key={type}
                type={type}
                rows={rows.filter((r) => r.type === type)}
                iso={iso}
                lockedForeignKeys={lockedForeignKeys}
                selections={selections}
                setSelections={setSelections}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
                onOpenPreview={openPreview}
                outputsMap={outputsMap}
                loadingMap={loadingMap}
                userModifiedKeys={userModifiedKeys}
              />
            ))}
          </div>
        </div>
      </div>

      {previewIndex !== null && (
        <ContentPreviewModal
          iso={iso}
          items={previewItems}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
          onScheduleSuccess={handleScheduleSuccess}
        />
      )}
    </div>
  )
}

function TypeGroup({
  type,
  rows,
  iso,
  lockedForeignKeys,
  selections,
  setSelections,
  openDropdown,
  setOpenDropdown,
  onOpenPreview,
  outputsMap,
  loadingMap,
  userModifiedKeys,
}: {
  type: ContentType
  rows: FlatRow[]
  iso: string
  lockedForeignKeys: Record<string, { isoDate: string; category: string; idea: string; fixture?: string; status: string }>
  selections: Record<string, SelectionState>
  setSelections: React.Dispatch<React.SetStateAction<Record<string, SelectionState>>>
  openDropdown: { key: string; kind: "fixture" | "cid" } | null
  setOpenDropdown: React.Dispatch<React.SetStateAction<{ key: string; kind: "fixture" | "cid" } | null>>
  onOpenPreview: (key: string) => void
  outputsMap: Record<string, OutputItem[]>
  loadingMap: Record<string, boolean>
  userModifiedKeys: React.MutableRefObject<Set<string>>
}) {
  const style = TYPE_STYLES[type]

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row">
      <div
        className={`flex w-full shrink-0 items-center justify-center rounded-lg border-2 py-2 text-base font-semibold sm:w-32 sm:py-0 sm:text-lg ${style.label}`}
      >
        {type}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {rows.map((row) => (
          <ContentRow
            key={row.key}
            row={row}
            style={style}
            iso={iso}
            lockedForeignKeys={lockedForeignKeys}
            selection={selections[row.key] ?? {}}
            onSelectCid={(cid, matchedItem, newFixture) => {
              userModifiedKeys.current.add(row.key)
              setSelections((prev) => {
                const existing = prev[row.key] ?? {}
                return {
                  ...prev,
                  [row.key]: {
                    ...existing,
                    cid,
                    fixture: newFixture ?? existing.fixture,
                    outputItem: matchedItem,
                  },
                }
              })
            }}
            onSelectFixture={(fixture, newCid, newOutputItem) => {
              userModifiedKeys.current.add(row.key)
              setSelections((prev) => {
                const existing = prev[row.key] ?? {}
                return {
                  ...prev,
                  [row.key]: {
                    ...existing,
                    fixture,
                    cid: newCid || "",
                    outputItem: newOutputItem,
                  },
                }
              })
            }}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
            onOpenPreview={onOpenPreview}
            outputsMap={outputsMap}
            loadingMap={loadingMap}
          />
        ))}
      </div>
    </div>
  )
}

export type DropdownOption = {
  label: string
  subLabel?: string
  className?: string
  value?: string
  disabled?: boolean
}

function matchesFixture(itemFixture?: string, selectedFixture?: string): boolean {
  if (!itemFixture || !selectedFixture) return false
  const clean = (s: string) => s.toLowerCase().trim().replace(/s$/, "")
  const a = clean(itemFixture)
  const b = clean(selectedFixture)
  if (a === b) return true
  const aIsCluster = a.includes("cluster")
  const bIsCluster = b.includes("cluster")
  if (aIsCluster !== bIsCluster) return false
  return a.includes(b) || b.includes(a)
}

function ContentRow({
  row,
  style,
  iso,
  lockedForeignKeys,
  selection,
  onSelectCid,
  onSelectFixture,
  openDropdown,
  setOpenDropdown,
  onOpenPreview,
  outputsMap,
  loadingMap,
}: {
  row: FlatRow
  style: RowStyle
  iso: string
  lockedForeignKeys: Record<string, { isoDate: string; category: string; idea: string; fixture?: string; status: string }>
  selection: SelectionState
  onSelectCid: (cid: string, matchedItem?: OutputItem, newFixture?: string) => void
  onSelectFixture: (fixture: string, newCid?: string, newOutputItem?: OutputItem) => void
  openDropdown: { key: string; kind: "fixture" | "cid" } | null
  setOpenDropdown: React.Dispatch<React.SetStateAction<{ key: string; kind: "fixture" | "cid" } | null>>
  onOpenPreview: (key: string) => void
  outputsMap: Record<string, OutputItem[]>
  loadingMap: Record<string, boolean>
}) {
  const entry = row.entry
  const isEmpty = !entry || !isRealIdea(entry.idea)

  if (isEmpty) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1.3fr_1.3fr]">
        {["N/A", "N/A", "N/A", "N/A"].map((v, i) => (
          <div
            key={i}
            className={`flex items-center justify-center rounded-lg border-2 py-2 text-sm font-medium sm:py-2.5 sm:text-base ${style.empty}`}
          >
            {v}
          </div>
        ))}
      </div>
    )
  }

  const fixture = selection.fixture ?? entry.fixture
  const cid = selection.cid !== undefined ? selection.cid : entry.cid

  const pairKey = `${row.type}::${entry.idea}`
  const items = outputsMap[pairKey] || []
  const isLoading = loadingMap[pairKey] || false

  // Generate dynamic CID dropdown options strictly according to lighting fixture results
  let cidOptions: DropdownOption[] = []

  if (!fixture) {
    cidOptions = [{ label: "Please select a Fixture first", disabled: true }]
  } else if (isLoading) {
    cidOptions = [{ label: "Loading Foreign Keys...", disabled: true }]
  } else {
    // Filter items: fixture match AND (Completed OR Posted OR currently selected cid), strictly excluding For Manual & Discard
    const matching = items.filter(
      (it) =>
        matchesFixture(it.fixtureType, fixture) &&
        it.status !== "For Manual" &&
        it.status !== "Discard" &&
        (it.status === "Completed" || it.status === "Posted" || (Boolean(cid) && it.foreignKeyId === cid))
    )

    if (matching.length > 0) {
      cidOptions = matching.map((it) => {
        const lockedInfo = lockedForeignKeys[it.foreignKeyId]
        const isLockedOnOtherDate = Boolean(lockedInfo && lockedInfo.isoDate !== iso)
        const statusTag = it.status === "Posted" ? " [Posted]" : ""

        return {
          label: `${it.foreignKeyId}${statusTag}`,
          subLabel: isLockedOnOtherDate
            ? `(Already scheduled on ${formatLongDate(lockedInfo.isoDate)})`
            : (it.itemNames?.[0] || it.fixtureType),
          value: it.foreignKeyId,
          disabled: isLockedOnOtherDate,
          className: isLockedOnOtherDate
            ? "text-neutral-400 bg-neutral-100/80 cursor-not-allowed line-through"
            : "text-neutral-800",
        }
      })
    } else {
      cidOptions = [{ label: "No Available CIDs (0)", disabled: true }]
    }
  }

  // Generate Fixture dropdown options with real counts of available items (Completed + Posted, strictly excluding For Manual & Discard)
  const fixtureOptions: DropdownOption[] = FIXTURES.map((f) => {
    const count = items.filter(
      (it) =>
        matchesFixture(it.fixtureType, f.name) &&
        it.status !== "For Manual" &&
        it.status !== "Discard" &&
        (it.status === "Completed" || it.status === "Posted" || (Boolean(cid) && it.foreignKeyId === cid))
    ).length
    return {
      label: count > 0 ? `${f.name} (${count})` : `${f.name} (0)`,
      value: f.name,
      className: count > 0 ? f.className : "text-neutral-400 opacity-50",
      disabled: count === 0 && !isLoading,
    }
  })

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1.3fr_1.3fr]">
      <button
        type="button"
        onClick={() => onOpenPreview(row.key)}
        className={`flex items-center justify-center rounded-lg border-2 px-2 py-2 text-center text-sm font-medium transition-opacity hover:opacity-70 sm:px-3 sm:py-2.5 sm:text-base ${style.cell}`}
      >
        {entry.idea}
      </button>
      <div
        className={`flex items-center justify-center rounded-lg border-2 py-2 text-sm font-medium sm:py-2.5 sm:text-base ${style.cell}`}
      >
        {entry.time ?? "—"}
      </div>

      <Dropdown
        placeholder="Fixture"
        value={fixture}
        options={fixtureOptions}
        isOpen={openDropdown?.key === row.key && openDropdown.kind === "fixture"}
        onToggle={(open) => setOpenDropdown(open ? { key: row.key, kind: "fixture" } : null)}
        onPick={(v) => {
          const matchingItems = items.filter(
            (it) =>
              matchesFixture(it.fixtureType, v) &&
              it.status !== "For Manual" &&
              it.status !== "Discard"
          )
          const firstMatch =
            matchingItems.find((it) => it.status === "Completed") ||
            matchingItems.find((it) => it.status === "Posted")
          onSelectFixture(v, firstMatch?.foreignKeyId, firstMatch)
          setOpenDropdown(null)
        }}
      />
      <Dropdown
        placeholder={fixture ? "CID" : "Select Fixture first"}
        value={cid}
        options={cidOptions}
        isOpen={openDropdown?.key === row.key && openDropdown.kind === "cid"}
        onToggle={(open) => setOpenDropdown(open ? { key: row.key, kind: "cid" } : null)}
        onPick={(v) => {
          const matched = items.find((it) => it.foreignKeyId === v)
          onSelectCid(v, matched, fixture)
          setOpenDropdown(null)
        }}
      />
    </div>
  )
}

function Dropdown({
  placeholder,
  value,
  options,
  isOpen,
  onToggle,
  onPick,
}: {
  placeholder: string
  value?: string
  options: DropdownOption[]
  isOpen: boolean
  onToggle: (open: boolean) => void
  onPick: (value: string) => void
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [openUp, setOpenUp] = useState(false)

  // Sized to show options without being cut off by viewport edge
  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUp(spaceBelow < 320 && rect.top > spaceBelow)
    }
    onToggle(!isOpen)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between rounded-lg border-2 border-neutral-300 bg-neutral-100 px-2 py-2 text-sm font-medium text-neutral-600 sm:px-3 sm:py-2.5 sm:text-base"
      >
        <span className="truncate">{value ?? placeholder}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 shrink-0" strokeWidth={2.5} />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" strokeWidth={2.5} />
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-20 max-h-[min(20rem,55vh)] min-w-[15rem] overflow-auto rounded-lg border-2 border-neutral-200 bg-white py-1 shadow-xl ${
            openUp ? "bottom-[calc(100%+0.25rem)]" : "top-[calc(100%+0.25rem)]"
          }`}
        >
          {options.map((opt) => (
            <button
              key={opt.value ?? opt.label}
              type="button"
              disabled={opt.disabled}
              onClick={() => {
                if (!opt.disabled) onPick(opt.value ?? opt.label)
              }}
              className={`block w-full px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-neutral-100 sm:text-base disabled:cursor-default disabled:opacity-50 ${
                opt.className ?? "text-neutral-700"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold">{opt.label}</span>
                {opt.subLabel && (
                  <span className="shrink-0 rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                    {opt.subLabel}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

