"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { CalendarNav } from "@/components/calendar-nav"
import { CalendarGrid } from "@/components/calendar-grid"
import { CalendarLegend } from "@/components/calendar-legend"
import { DayDetailModal } from "@/components/day-detail-modal"
import { ScheduledPostsModal } from "@/components/scheduled-posts-modal"
import { UniversalContentGallery } from "@/components/universal-content-gallery"
import { type ActiveContent } from "@/components/calendar-nav"
import { MONTH_NAMES } from "@/lib/calendar-data"
import {
  CONTENT_DAYS,
  CONTENT_MONTHS,
  buildMonthCells,
  type ContentEntry,
} from "@/lib/content"
import {
  latestMonth,
  mergeCalendarDays,
  pickImportTargetMonth,
} from "@/lib/calendar-months"
import type { ScheduledEntry } from "@/app/api/schedules/route"

export function ContentCalendar() {
  const [selectedContent, setSelectedContent] = useState<ActiveContent | null>(null)
  // September 2026 (month index 8) to match the reference.
  const [current, setCurrent] = useState({ year: 2026, month: 8 })
  const [selectedIso, setSelectedIso] = useState<string | null>(null)
  const [showScheduledModal, setShowScheduledModal] = useState(false)

  // Months imported through the Studio, loaded from the calendar API.
  const [savedMonths, setSavedMonths] = useState<string[]>([])
  const [savedDays, setSavedDays] = useState<Record<string, ContentEntry[]>>({})
  const [calendarReady, setCalendarReady] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importError, setImportError] = useState(false)

  // Persisted schedules and locked foreign key IDs across dates
  const [schedules, setSchedules] = useState<Record<string, ScheduledEntry[]>>({})
  const [lockedForeignKeys, setLockedForeignKeys] = useState<
    Record<
      string,
      { isoDate: string; category: string; idea: string; fixture?: string; status: string }
    >
  >({})

  // Load existing schedules and locked foreign keys from the persistence API
  useEffect(() => {
    async function loadSchedules() {
      try {
        const res = await fetch("/api/schedules")
        if (res.ok) {
          const data = await res.json()
          if (data.schedules) setSchedules(data.schedules)
          if (data.lockedForeignKeys) setLockedForeignKeys(data.lockedForeignKeys)
        }
      } catch (err) {
        console.error("Failed to load schedules:", err)
      }
    }
    loadSchedules()

    // Periodic UI refresh every 10 seconds (Auto Sync)
    const interval = setInterval(() => {
      loadSchedules()
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  // Load the durable calendar, then open the newest saved month. The seed stays
  // visible if storage is unavailable, so the page never renders empty.
  useEffect(() => {
    let cancelled = false

    async function loadSavedCalendar() {
      try {
        const response = await fetch("/api/calendar")
        const data = response.ok ? await response.json() : null
        if (!response.ok || !data?.success) throw new Error("calendar load failed")
        if (cancelled) return

        const months: string[] = Array.isArray(data.months) ? data.months : []
        setSavedMonths(months)
        setSavedDays(data.days && typeof data.days === "object" ? data.days : {})

        const newest = latestMonth(months)
        if (newest) {
          const [year, month] = newest.split("-").map(Number)
          if (year && month) setCurrent({ year, month: month - 1 })
        }
      } catch {
        if (!cancelled) {
          setImportError(true)
          setImportStatus("Saved calendar unavailable — showing the built-in schedule.")
        }
      } finally {
        if (!cancelled) setCalendarReady(true)
      }
    }

    loadSavedCalendar()
    return () => {
      cancelled = true
    }
  }, [])

  const dayMap = useMemo(
    () => mergeCalendarDays(CONTENT_DAYS, savedMonths, savedDays),
    [savedMonths, savedDays],
  )

  const activeScheduledCount = useMemo(() => {
    let count = 0
    for (const entries of Object.values(schedules)) {
      for (const e of entries) {
        if (e.status === "Scheduled") count++
      }
    }
    return count
  }, [schedules])

  const cells = useMemo(
    () => buildMonthCells(current.year, current.month, dayMap),
    [current, dayMap],
  )

  function shiftMonth(delta: number) {
    setCurrent((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  function formatImportDate(value: unknown): string {
    if (typeof value !== "string") return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  async function handleImportFile(file: File) {
    if (!calendarReady) return
    setImportError(false)
    setImportStatus("Importing calendar...")

    // Capture what we knew before the upload so the newly imported month wins.
    const knownMonths = new Set<string>([...CONTENT_MONTHS, ...savedMonths])

    try {
      const form = new FormData()
      form.append("file", file)

      const response = await fetch("/api/calendar", { method: "POST", body: form })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        setImportError(true)
        setImportStatus(result?.error ?? "Couldn't import that file. Try again.")
        return
      }

      const refreshed = await fetch("/api/calendar")
      if (!refreshed.ok) {
        setImportError(true)
        setImportStatus("Imported, but the calendar could not refresh. Reload the page.")
        return
      }
      const snapshot = await refreshed.json().catch(() => null)
      if (!snapshot?.success) {
        setImportError(true)
        setImportStatus("Imported, but the calendar could not refresh. Reload the page.")
        return
      }

      setSavedMonths(Array.isArray(snapshot.months) ? snapshot.months : [])
      setSavedDays(snapshot.days && typeof snapshot.days === "object" ? snapshot.days : {})

      const savedMonthsResult: string[] = Array.isArray(result.savedMonths)
        ? result.savedMonths
        : []
      const target = pickImportTargetMonth(savedMonthsResult, knownMonths)
      if (target) {
        const [year, month] = target.split("-").map(Number)
        if (year && month) setCurrent({ year, month: month - 1 })
      }

      const dayCount = Number(result.dayCount) || 0
      const monthCount = savedMonthsResult.length
      const targetLabel = target
        ? `${MONTH_NAMES[Number(target.slice(5, 7)) - 1]} ${target.slice(0, 4)}`
        : ""
      const importedAt = Array.isArray(snapshot.imports) ? snapshot.imports[0]?.importedAt : null
      const importedLabel = importedAt ? `huling import ${formatImportDate(importedAt)}` : ""
      const ignored = Number(result.ignoredRows) > 0
        ? ` · ${result.ignoredRows} undated row${Number(result.ignoredRows) === 1 ? "" : "s"} ignored`
        : ""

      setImportStatus(
        [
          `Imported ${dayCount} day${dayCount === 1 ? "" : "s"} across ${monthCount} month${monthCount === 1 ? "" : "s"}`,
          targetLabel,
          importedLabel,
        ]
          .filter(Boolean)
          .join(" · ") + ignored,
      )
    } catch {
      setImportError(true)
      setImportStatus("Couldn't import that file. Check your connection and try again.")
    }
  }

  const selectedEntries = selectedIso ? dayMap[selectedIso] ?? [] : []

  function handleScheduleSaved(entry: ScheduledEntry) {
    const isoDate = entry.isoDate
    setSchedules((prev) => {
      const dateEntries = prev[isoDate] || []
      const existingIdx = dateEntries.findIndex(
        (e) => e.rowKey === entry.rowKey || (e.recordId && e.recordId === entry.recordId)
      )
      const updated = [...dateEntries]
      if (existingIdx >= 0) {
        updated[existingIdx] = entry
      } else {
        updated.push(entry)
      }
      return { ...prev, [isoDate]: updated }
    })

    if (entry.foreignKeyId) {
      setLockedForeignKeys((prev) => ({
        ...prev,
        [entry.foreignKeyId]: {
          isoDate,
          category: entry.category,
          idea: entry.idea,
          fixture: entry.fixture,
          status: entry.status,
        },
      }))
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <CalendarNav
        onImportFile={handleImportFile}
        importStatus={importStatus}
        importError={importError}
        onDismissStatus={() => setImportStatus(null)}
        importDisabled={!calendarReady}
        activeContent={selectedContent}
        onSelectContent={(category, type) => setSelectedContent({ category, type })}
        onBackToCalendar={() => setSelectedContent(null)}
      />

      {selectedContent ? (
        <UniversalContentGallery
          category={selectedContent.category}
          contentType={selectedContent.type}
          onBackToCalendar={() => setSelectedContent(null)}
        />
      ) : (
        <>
          <div className="mx-auto max-w-[1600px] px-3 pb-16 sm:px-8">
            {/* Header: Month Navigator in center + Figma Legend aligned to right */}
            <div className="relative flex flex-col items-center justify-between gap-4 py-6 md:flex-row sm:py-8">
              {/* Scheduled Posts Quick Access Button & Auto-Sync Indicator */}
              <div className="flex items-center gap-2.5 justify-start lg:w-80">
                <button
                  type="button"
                  onClick={() => setShowScheduledModal(true)}
                  className="flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400 hover:bg-blue-500/20 hover:border-blue-400 transition-all shadow-sm"
                  title="View all active scheduled posts"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Scheduled
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-extrabold text-white">
                    {activeScheduledCount}
                  </span>
                </button>
              </div>

              {/* Month Switcher */}
              <div className="flex items-center gap-3 sm:gap-6">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  className="text-white transition-opacity hover:opacity-70"
                >
                  <ChevronLeft className="h-6 w-6 sm:h-9 sm:w-9" strokeWidth={2} />
                </button>

                <div className="flex flex-col items-center">
                  <h1 className="text-2xl font-semibold text-white sm:text-4xl">
                    {MONTH_NAMES[current.month]} {current.year}
                  </h1>
                  <span className="mt-2 h-0.5 w-40 bg-white sm:w-64" />
                </div>

                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  className="text-white transition-opacity hover:opacity-70"
                >
                  <ChevronRight className="h-6 w-6 sm:h-9 sm:w-9" strokeWidth={2} />
                </button>
              </div>

              {/* Figma Legend Container (Category Dots + Status Pills) */}
              <div className="flex shrink-0 items-center justify-center md:justify-end">
                <CalendarLegend />
              </div>
            </div>

            {/* Calendar Grid with dynamic scheduled pills */}
            <CalendarGrid
              cells={cells}
              onSelectDay={setSelectedIso}
              schedules={schedules}
            />
          </div>

          {selectedIso && (
            <DayDetailModal
              iso={selectedIso}
              entries={selectedEntries}
              lockedForeignKeys={lockedForeignKeys}
              existingSchedules={schedules[selectedIso] || []}
              onScheduleSaved={handleScheduleSaved}
              onClose={() => setSelectedIso(null)}
            />
          )}

          {showScheduledModal && (
            <ScheduledPostsModal
              schedules={schedules}
              onClose={() => setShowScheduledModal(false)}
              onScheduleCancelled={(isoDate, rowKey, foreignKeyId) => {
                setSchedules((prev) => {
                  const updated = { ...prev }
                  if (updated[isoDate]) {
                    updated[isoDate] = updated[isoDate].filter(
                      (e) => e.rowKey !== rowKey && (!foreignKeyId || e.foreignKeyId !== foreignKeyId)
                    )
                  }
                  return updated
                })
                if (foreignKeyId) {
                  setLockedForeignKeys((prev) => {
                    const updated = { ...prev }
                    delete updated[foreignKeyId]
                    return updated
                  })
                }
              }}
              onJumpToDate={(iso) => setSelectedIso(iso)}
            />
          )}
        </>
      )}
    </div>
  )
}
