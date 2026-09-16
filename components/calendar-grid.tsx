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
          const daySchedules = (schedules[iso] || []).filter((s) => s.status === "Scheduled")
          const scheduledCategories = new Set(daySchedules.map((s) => s.category))
          // Unscheduled types on this day that should still display their category tag
          const unscheduledTypes = cell.types.filter((t) => !scheduledCategories.has(t))

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

                  {/* Day Content Container */}
                  <div className="mt-1.5 flex flex-col gap-1 sm:mt-2.5 sm:gap-1.5">
                    {/* 1. Render Active Scheduled Posts (with Category Dot & Status Pill) */}
                    {daySchedules.map((sched, sIdx) => {
                      const dotColor = CATEGORY_DOT_STYLES[sched.category] || "bg-neutral-400"
                      const pillStyle =
                        STATUS_PILL_STYLES[sched.status] ||
                        STATUS_PILL_STYLES["Scheduled"] ||
                        "bg-[#cffafe] text-[#155e75]"

                      return (
                        <div
                          key={`sched-${sIdx}`}
                          className={`group relative flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[9px] font-semibold leading-snug sm:rounded-md sm:px-2 sm:py-1 sm:text-[11px] ${pillStyle}`}
                          title={`${sched.category}: ${sched.idea} (${sched.status})`}
                        >
                          {/* Category Dot */}
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2 ${dotColor}`}
                          />
                          {/* Content Title */}
                          <span className="truncate">{sched.idea}</span>
                        </div>
                      )
                    })}

                    {/* 2. Render Category Tags for Unscheduled Types so legends never vanish */}
                    {unscheduledTypes.map((type) => (
                      <span
                        key={`tag-${type}`}
                        className={`w-fit rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight sm:px-2.5 sm:py-1 sm:text-xs ${TYPE_TAG_STYLES[type]}`}
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
