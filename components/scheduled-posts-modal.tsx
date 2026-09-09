"use client"

import { useState } from "react"
import { Calendar, Clock, ExternalLink, Trash2, X } from "lucide-react"
import type { ScheduledEntry } from "@/app/api/schedules/route"
import { CATEGORY_DOT_STYLES } from "@/lib/content"

export function ScheduledPostsModal({
  schedules,
  onClose,
  onScheduleCancelled,
  onJumpToDate,
}: {
  schedules: Record<string, ScheduledEntry[]>
  onClose: () => void
  onScheduleCancelled: (isoDate: string, rowKey: string, foreignKeyId?: string) => void
  onJumpToDate: (isoDate: string) => void
}) {
  const [cancellingKey, setCancellingKey] = useState<string | null>(null)

  // Flatten and sort active scheduled items by date and time
  const scheduledList = Object.entries(schedules).flatMap(([isoDate, entries]) =>
    entries
      .filter((e) => e.status === "Scheduled")
      .map((e) => ({ ...e, isoDate }))
  ).sort((a, b) => {
    const dtA = `${a.isoDate}T${a.time || "00:00"}`
    const dtB = `${b.isoDate}T${b.time || "00:00"}`
    return dtA.localeCompare(dtB)
  })

  async function handleCancel(item: ScheduledEntry) {
    if (!confirm(`Are you sure you want to cancel the schedule for ${item.foreignKeyId || item.idea}?`)) {
      return
    }

    const itemKey = `${item.isoDate}::${item.rowKey}::${item.foreignKeyId}`
    setCancellingKey(itemKey)

    try {
      const params = new URLSearchParams()
      if (item.isoDate) params.set("isoDate", item.isoDate)
      if (item.rowKey) params.set("rowKey", item.rowKey)
      if (item.tableId) params.set("tableId", item.tableId)
      if (item.recordId) params.set("recordId", item.recordId)
      if (item.foreignKeyId) params.set("foreignKeyId", item.foreignKeyId)

      // 1. Reset in Airtable
      if (item.tableId && item.recordId) {
        await fetch("/api/content-outputs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordId: item.recordId,
            tableId: item.tableId,
            status: "Completed",
          }),
        })
      }

      // 2. Delete schedule
      await fetch(`/api/schedules?${params.toString()}`, {
        method: "DELETE",
      })

      onScheduleCancelled(item.isoDate, item.rowKey, item.foreignKeyId)
    } catch (err) {
      console.error("Error cancelling schedule:", err)
      alert("Failed to cancel schedule. Please check connection.")
    } finally {
      setCancellingKey(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Active Scheduled Posts</h2>
                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/30">
                  {scheduledList.length} queued
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Posts scheduled for automatic publishing to Instagram
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6">
          {scheduledList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800 text-neutral-500">
                <Clock className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-medium text-neutral-300">
                No active scheduled posts.
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Schedule content from the calendar to view and manage it here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledList.map((item) => {
                const itemKey = `${item.isoDate}::${item.rowKey}::${item.foreignKeyId}`
                const isCancelling = cancellingKey === itemKey
                const dotStyle = CATEGORY_DOT_STYLES[item.category] || "bg-neutral-400"

                return (
                  <div
                    key={itemKey}
                    className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-800/40 p-4 transition-all hover:border-neutral-700 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${dotStyle}`}
                        title={item.category}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {item.foreignKeyId || item.idea}
                          </span>
                          <span className="rounded bg-neutral-700/60 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-300">
                            {item.category}
                          </span>
                          {item.fixture && (
                            <span className="rounded bg-neutral-700/40 px-1.5 py-0.5 text-[11px] text-neutral-400">
                              {item.fixture}
                            </span>
                          )}
                        </div>

                        {item.itemNames && item.itemNames.length > 0 && (
                          <p className="mt-0.5 text-xs text-neutral-300">
                            {item.itemNames.join(", ")}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                          <span className="flex items-center gap-1 font-medium text-blue-400">
                            <Clock className="h-3.5 w-3.5" />
                            {item.isoDate} at {item.time || "00:00"} PHT
                          </span>

                          {item.airtableUrl && (
                            <a
                              href={item.airtableUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-neutral-400 hover:text-white transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Airtable
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          onJumpToDate(item.isoDate)
                        }}
                        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-800 transition-colors"
                      >
                        View on Calendar
                      </button>

                      <button
                        type="button"
                        disabled={isCancelling}
                        onClick={() => handleCancel(item)}
                        className="flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {isCancelling ? "Cancelling..." : "Cancel Schedule"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
