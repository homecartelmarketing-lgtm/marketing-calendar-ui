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
import { CONTENT_DAYS, buildMonthCells, type ContentEntry } from "@/lib/content"
import { parseContentCsv } from "@/lib/csv"
import { parseContentWorkbook } from "@/lib/workbook"
import type { ScheduledEntry } from "@/app/api/schedules/route"

export function ContentCalendar() {
  const [selectedContent, setSelectedContent] = useState<ActiveContent | null>(null)
  // September 2026 (month index 8) to match the reference.
  const [current, setCurrent] = useState({ year: 2026, month: 8 })
  const [selectedIso, setSelectedIso] = useState<string | null>(null)
  const [showScheduledModal, setShowScheduledModal] = useState(false)

  // Imported content merged over the built-in workbook data, keyed by ISO date.
  const [overrides, setOverrides] = useState<Record<string, ContentEntry[]>>({})
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

  const dayMap = useMemo(() => ({ ...CONTENT_DAYS, ...overrides }), [overrides])

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

  function mergeByDate(byDate: Record<string, ContentEntry[]>) {
    setOverrides((prev) => {
      const next = { ...prev }
      for (const [date, entries] of Object.entries(byDate)) {
        next[date] = entries
      }
      return next
    })
  }

  async function handleImportFile(file: File) {
    setImportError(false)
    try {
      const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv"
      if (isCsv) {
        const text = await file.text()
        const result = parseContentCsv(text)
        mergeByDate(result.byDate)
        const days = Object.keys(result.byDate).length
        setImportStatus(`Imported ${result.rowCount} row${result.rowCount === 1 ? "" : "s"} across ${days} day${days === 1 ? "" : "s"}`)
        return
      }

      const buffer = await file.arrayBuffer()
      const { byDate, months, dayCount } = parseContentWorkbook(buffer)
      if (dayCount === 0) {
        setImportError(true)
        setImportStatus("No calendar data found in that file")
        return
      }
      mergeByDate(byDate)

      // Jump to the first imported month so the new content is visible.
      const first = months[0]?.split("-").map(Number)
      if (first) setCurrent({ year: first[0], month: first[1] - 1 })

      setImportStatus(`Imported ${dayCount} days across ${months.length} month${months.length === 1 ? "" : "s"}`)
    } catch {
      setImportError(true)
      setImportStatus("Couldn't read that file. Upload a .xlsx or .csv calendar.")
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

                <div
                  className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400"
                  title="Calendar automatically syncs with Airtable every 10 seconds"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Auto-sync Active</span>
                </div>
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
