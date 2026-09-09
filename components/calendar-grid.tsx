"use client"

import { WEEKDAYS } from "@/lib/calendar-data"
import {
  CATEGORY_DOT_STYLES,
  STATUS_PILL_STYLES,
  TYPE_TAG_STYLES,
  type CalendarCell,
  type ContentEntry,
  type ContentType,
} from "@/lib/content"
import type { ScheduledEntry } from "@/app/api/schedules/route"

export function CalendarGrid({
  cells,
  onSelectDay,
  schedules = {},
}: {
  cells: CalendarCell[]
  onSelectDay: (iso: string) => void
  schedules?: Record<string, ScheduledEntry[]>
}) {
  return (
    <div className="border border-black bg-white shadow-sm">
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="border-b border-r border-black px-1 py-2 text-center text-[11px] font-bold tracking-wider text-neutral-500 last:border-r-0 sm:px-3 sm:py-3 sm:text-left sm:text-sm"
          >
            {day}
          </div>
        ))}

        {cells.map((cell, index) => {
          const isDay = cell.day !== null
          const clickable = isDay && cell.iso !== null
          const iso = cell.iso || ""
          const daySchedules = schedules[iso] || []
          const hasScheduled = daySchedules.length > 0

          // Prepare flat list of entries for this day to render
          // (Feeds, Reels, Stories) if scheduled
          const displayEntries: {
            type: ContentType
            idea: string
            status: string
          }[] = []

          if (hasScheduled) {
            // Check all standard entries for this date
            const entries = cell.entries || []
            const usedTypes = new Set<ContentType>()

            for (const entry of entries) {
              const matchedSched = daySchedules.find(
                (s) =>
                  s.category === entry.type &&
                  (s.idea === entry.idea || (entry.idea.trim().toUpperCase() === "NONE" && s.idea))
              )
              const status = matchedSched?.status || entry.status || "To Do"
              const idea = matchedSched?.idea || (entry.idea.trim().toUpperCase() === "NONE" ? "N/A" : entry.idea)

              displayEntries.push({
                type: entry.type,
                idea,
                status,
              })
              usedTypes.add(entry.type)
            }

            // Ensure Feeds and Reels are visible if not in entries
            if (!usedTypes.has("Feeds")) {
              const sched = daySchedules.find((s) => s.category === "Feeds")
              displayEntries.unshift({
                type: "Feeds",
                idea: sched?.idea || "N/A",
                status: sched?.status || "N/A",
              })
            }
          }

          return (
            <div
              key={index}
              onClick={clickable ? () => onSelectDay(iso) : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onSelectDay(iso)
                      }
                    }
                  : undefined
              }
              className={`min-h-[90px] border-b border-r border-black p-1.5 transition-colors [&:nth-child(7n+7)]:border-r-0 sm:min-h-[190px] sm:p-2.5 ${
                isDay
                  ? "cursor-pointer bg-white hover:bg-neutral-50/80"
                  : "bg-neutral-100/70"
              }`}
            >
              {isDay && (
                <>
                  <span className="text-sm font-normal text-black sm:text-xl">
                    {cell.day}
                  </span>

                  {/* Scheduled Mode (Figma Day 3 Pill Badges with Category Dots) */}
                  {hasScheduled ? (
                    <div className="mt-1.5 flex flex-col gap-1 sm:mt-2.5 sm:gap-1.5">
                      {displayEntries.map((item, i) => {
                        const dotColor = CATEGORY_DOT_STYLES[item.type] || "bg-neutral-400"
                        const pillStyle =
                          STATUS_PILL_STYLES[item.status] ||
                          (item.idea === "N/A"
                            ? STATUS_PILL_STYLES["N/A"]
                            : "bg-neutral-100 text-neutral-700")

                        return (
                          <div
                            key={i}
                            className={`group relative flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-snug sm:rounded-md sm:px-2 sm:py-1 sm:text-[11px] ${pillStyle}`}
                            title={`${item.type}: ${item.idea} (${item.status})`}
                          >
                            {/* Category Dot */}
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2 ${dotColor}`}
                            />
                            {/* Content Title */}
                            <span className="truncate">{item.idea}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    /* Default Mode (Category Tags: Feeds, Reels, Stories) */
                    cell.types.length > 0 && (
                      <div className="mt-2 flex flex-col items-start gap-1 sm:mt-5 sm:gap-2">
                        {cell.types.map((type) => (
                          <span
                            key={type}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight sm:px-2.5 sm:py-1 sm:text-xs ${TYPE_TAG_STYLES[type]}`}
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
