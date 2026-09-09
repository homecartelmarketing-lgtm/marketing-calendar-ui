"use client"

import { useEffect, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Link2,
  Pencil,
  Share2,
  Trash2,
  X,
} from "lucide-react"
import { formatLongDate, type ContentType } from "@/lib/content"
import type { OutputItem } from "@/app/api/content-outputs/route"
import type { ScheduledEntry } from "@/app/api/schedules/route"

export type PreviewItem = {
  key: string
  type: ContentType
  idea: string
  time: string | null
  fixture?: string
  cid?: string
  outputItem?: OutputItem
}

const TYPE_LABELS: Record<ContentType, string> = {
  Feeds: "Feed",
  Reels: "Reel",
  Stories: "Story",
}

const STATUS_OPTIONS = ["Posted", "Scheduled", "Completed", "Discard", "For Manual"]

export function ContentPreviewModal({
  iso,
  items,
  index,
  onIndexChange,
  onClose,
  onScheduleSuccess,
}: {
  iso: string
  items: PreviewItem[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  onScheduleSuccess?: (key: string, status: string, fullEntry?: ScheduledEntry) => void
}) {
  const item = items[index]

  const [statusByKey, setStatusByKey] = useState<Record<string, string>>({})
  const [captionByKey, setCaptionByKey] = useState<Record<string, string>>({})
  const [activeSlide, setActiveSlide] = useState(0)
  const [statusOpen, setStatusOpen] = useState(false)
  const [editingCaption, setEditingCaption] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successTitle, setSuccessTitle] = useState("SUCCESFULLY UPDATED & SCHEDULED!")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPostingMeta, setIsPostingMeta] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  // Reset transient sub-states when navigating between items.
  useEffect(() => {
    setActiveSlide(0)
    setStatusOpen(false)
    setEditingCaption(false)
    setConfirmDiscard(false)
    setShowSuccess(false)
  }, [index])

  if (!item) return null

  const out = item.outputItem
  const status = statusByKey[item.key] ?? out?.status ?? "Completed"
  const caption = captionByKey[item.key] ?? out?.caption ?? ""
  const slides = out?.slides || []
  const isVideo = out?.mediaType === "video" && Boolean(out?.videoUrl)

  function goPrev() {
    onIndexChange((index - 1 + items.length) % items.length)
  }
  function goNext() {
    onIndexChange((index + 1) % items.length)
  }

  async function confirmSchedule() {
    setIsSubmitting(true)
    let savedEntry: ScheduledEntry | undefined = undefined
    try {
      const finalStatus = status || "Scheduled"

      // 1. Update Airtable if record exists
      if (out?.recordId) {
        try {
          const patchRes = await fetch("/api/content-outputs", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recordId: out.recordId,
              tableId: out.tableId,
              status: finalStatus,
              date: iso,
              time: item.time,
            }),
          })
          if (!patchRes.ok) {
            console.warn("Airtable sync warning:", await patchRes.text())
          }
        } catch (airtableErr) {
          console.warn("Airtable sync warning:", airtableErr)
        }
      }

      // 2. Persist to Schedules API & Local Storage
      const schedRes = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: out?.recordId,
          tableId: out?.tableId,
          isoDate: iso,
          rowKey: item.key,
          category: item.type,
          idea: item.idea,
          time: item.time,
          fixture: item.fixture,
          foreignKeyId: item.cid || out?.foreignKeyId || "",
          status: finalStatus,
          caption: caption,
          airtableUrl: out?.airtableUrl,
          itemNames: out?.itemNames,
        }),
      })

      if (schedRes.ok) {
        const schedData = await schedRes.json()
        savedEntry = schedData.entry
      }

      setStatusByKey((prev) => ({ ...prev, [item.key]: finalStatus }))
      onScheduleSuccess?.(item.key, finalStatus, savedEntry)
      setSuccessTitle("SUCCESSFULLY UPDATED & SCHEDULED!")
      setShowSuccess(true)
      window.setTimeout(() => {
        setShowSuccess(false)
        onClose()
      }, 1600)
    } catch (err) {
      console.error("Error scheduling:", err)
      setSuccessTitle("SUCCESSFULLY UPDATED & SCHEDULED!")
      setShowSuccess(true)
      window.setTimeout(() => {
        setShowSuccess(false)
        onClose()
      }, 1600)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function cancelSchedule() {
    if (!confirm("Are you sure you want to cancel and remove this schedule?")) return
    setIsSubmitting(true)
    try {
      // 1. Reset Airtable record back to "Completed" and clear Date and Time Scheduled
      if (out?.recordId && out?.tableId) {
        try {
          await fetch("/api/content-outputs", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recordId: out.recordId,
              tableId: out.tableId,
              status: "Completed",
            }),
          })
        } catch (airtableErr) {
          console.warn("Airtable unschedule sync warning:", airtableErr)
        }
      }

      // 2. Delete schedule entry from API
      const params = new URLSearchParams()
      if (iso) params.set("isoDate", iso)
      if (item.key) params.set("rowKey", item.key)
      if (out?.tableId) params.set("tableId", out.tableId)
      if (out?.recordId) params.set("recordId", out.recordId)
      if (item.cid || out?.foreignKeyId) params.set("foreignKeyId", item.cid || out?.foreignKeyId || "")

      await fetch(`/api/schedules?${params.toString()}`, {
        method: "DELETE",
      })

      setStatusByKey((prev) => ({ ...prev, [item.key]: "Completed" }))
      onScheduleSuccess?.(item.key, "Completed", undefined)
      setSuccessTitle("SCHEDULE CANCELLED & RESTORED TO COMPLETED!")
      setShowSuccess(true)
      window.setTimeout(() => {
        setShowSuccess(false)
        onClose()
      }, 1600)
    } catch (err) {
      console.error("Error cancelling schedule:", err)
      alert("Failed to cancel schedule. Please check your connection.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function postNowToMeta() {
    setIsPostingMeta(true)
    try {
      const mediaUrl = slides[0] || out?.videoUrl
      if (!mediaUrl) {
        alert("No image or video attachment found for this item to post.")
        setIsPostingMeta(false)
        return
      }

      const res = await fetch("/api/meta-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl,
          mediaType: isVideo ? "video" : "image",
          caption: caption,
          category: item.type,
          recordId: out?.recordId,
          tableId: out?.tableId,
          isoDate: iso,
          time: item.time,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setStatusByKey((prev) => ({ ...prev, [item.key]: "Posted" }))

        // Save schedule record as Posted
        let savedEntry: ScheduledEntry | undefined = undefined
        const schedRes = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordId: out?.recordId,
            tableId: out?.tableId,
            isoDate: iso,
            rowKey: item.key,
            category: item.type,
            idea: item.idea,
            time: item.time,
            fixture: item.fixture,
            foreignKeyId: item.cid || out?.foreignKeyId || "",
            status: "Posted",
            caption: caption,
            airtableUrl: out?.airtableUrl,
            itemNames: out?.itemNames,
          }),
        })

        if (schedRes.ok) {
          const schedData = await schedRes.json()
          savedEntry = schedData.entry
        }

        onScheduleSuccess?.(item.key, "Posted", savedEntry)
        setSuccessTitle("SUCCESSFULLY PUBLISHED TO INSTAGRAM!")
        setShowSuccess(true)
        window.setTimeout(() => {
          setShowSuccess(false)
          onClose()
        }, 1800)
      } else {
        alert(`Failed to publish to Meta: ${data.error || "Unknown error"}`)
      }
    } catch (err: any) {
      alert(`Error publishing to Meta: ${err?.message || err}`)
    } finally {
      setIsPostingMeta(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${item.idea}`}
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-black p-3 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-black transition-opacity hover:opacity-80"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* Preview panel */}
          <div className="rounded-2xl bg-white p-3 sm:p-4">
            <div className="mb-3 rounded-xl bg-black py-3 text-center">
              <span className="text-lg font-semibold text-white sm:text-2xl">Preview:</span>
            </div>

            <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-xl border-2 border-neutral-200 bg-neutral-900">
              {isVideo ? (
                <video
                  src={out!.videoUrl}
                  controls
                  className="h-full w-full object-contain"
                />
              ) : slides.length > 0 ? (
                <>
                  <img
                    src={slides[activeSlide]}
                    alt={`${item.idea} slide ${activeSlide + 1}`}
                    className="h-full w-full object-cover"
                  />
                  {slides.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveSlide((prev) => (prev > 0 ? prev - 1 : slides.length - 1))
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/90"
                        aria-label="Previous slide"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveSlide((prev) => (prev < slides.length - 1 ? prev + 1 : 0))
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/90"
                        aria-label="Next slide"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2.5 right-2.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                        {activeSlide + 1} / {slides.length}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <img
                  src="/placeholder.svg?height=760&width=570"
                  alt={`${item.idea} preview`}
                  className="h-full w-full object-cover"
                />
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-center text-white">
                <p className="text-base font-semibold sm:text-lg">
                  {out?.itemNames?.[0] || item.idea}
                </p>
                <p className="mt-1 text-[11px] leading-tight opacity-90">
                  Follow @HomeCartel for more home inspiration
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous content"
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-neutral-300 text-black transition-colors hover:bg-neutral-100"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next content"
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-neutral-300 text-black transition-colors hover:bg-neutral-100"
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                className="flex items-center gap-1.5 rounded-full bg-red-100 px-4 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-200"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                Discard
              </button>
            </div>
          </div>

          {/* Details panel */}
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-black p-3 sm:p-4">
              <dl className="flex flex-col gap-2">
                <DetailRow
                  label="Content ID"
                  value={item.cid ?? out?.foreignKeyId ?? "XXXX-XXXX-XX-01"}
                  muted
                />
                <DetailRow label="Content Name" value={out?.itemNames?.[0] || item.idea} />
                <DetailRow label="Content Type" value={TYPE_LABELS[item.type]} />
                <DetailRow label="Scheduled Date" value={formatLongDate(iso)} />
                <DetailRow label="Scheduled Time" value={item.time ?? "—"} />
                <DetailRow
                  label="Date of Generation"
                  value={
                    out?.generatedDate
                      ? out.generatedDate.split(" (")[0]
                      : out?.date
                      ? out.date.split(" (")[0]
                      : "—"
                  }
                />
                <DetailRow
                  label="Time of Generation"
                  value={out?.generatedTime || out?.time || "—"}
                />

                <div className="flex items-stretch gap-2">
                  <dt className="flex w-40 shrink-0 items-center justify-center rounded-lg bg-white px-2 py-2.5 text-center text-sm font-semibold text-black">
                    Status
                  </dt>
                  <dd className="relative min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setStatusOpen((o) => !o)}
                      aria-expanded={statusOpen}
                      className="flex w-full items-center justify-between rounded-lg border-2 border-neutral-300 bg-neutral-100 px-3 py-2.5 text-sm font-medium text-neutral-600"
                    >
                      <span className="truncate">{status}</span>
                      {statusOpen ? (
                        <ChevronUp className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                      )}
                    </button>
                    {statusOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-10 overflow-hidden rounded-lg border-2 border-neutral-200 bg-white py-1 shadow-xl">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              setStatusByKey((prev) => ({ ...prev, [item.key]: opt }))
                              setStatusOpen(false)
                            }}
                            className="block w-full px-3 py-2 text-center text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </dd>
                  <button
                    type="button"
                    onClick={() => {
                      if (out?.airtableUrl) {
                        window.open(out.airtableUrl, "_blank", "noopener,noreferrer")
                      }
                    }}
                    disabled={!out?.airtableUrl}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                      out?.airtableUrl
                        ? "bg-yellow-100 text-black hover:bg-yellow-200 cursor-pointer"
                        : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                    }`}
                  >
                    <Link2 className="h-4 w-4" strokeWidth={2.5} />
                    Link
                  </button>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl bg-black p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-base font-semibold text-white sm:text-lg">Generated Caption:</span>
                <button
                  type="button"
                  onClick={() => setEditingCaption((e) => !e)}
                  className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-200"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Edit Caption
                </button>
              </div>
              {editingCaption ? (
                <textarea
                  autoFocus
                  value={caption}
                  onChange={(e) => setCaptionByKey((prev) => ({ ...prev, [item.key]: e.target.value }))}
                  onBlur={() => setEditingCaption(false)}
                  placeholder="Write a caption..."
                  className="h-32 w-full resize-none rounded-lg bg-white p-3 text-sm text-black outline-none"
                />
              ) : (
                <div className="h-32 w-full overflow-y-auto rounded-lg bg-white p-3 text-sm text-neutral-700">
                  {caption.trim() ? caption : "N/A"}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {(status === "Scheduled" || out?.status === "Scheduled") && (
                <button
                  type="button"
                  disabled={isSubmitting || isPostingMeta}
                  onClick={cancelSchedule}
                  className="flex items-center gap-2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {isSubmitting ? "REMOVING..." : "CANCEL SCHEDULE"}
                </button>
              )}

              <button
                type="button"
                disabled={isSubmitting || isPostingMeta}
                onClick={postNowToMeta}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#f09433] via-[#e6683c] to-[#bc1888] px-5 py-2.5 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" />
                {isPostingMeta ? "PUBLISHING TO IG..." : "POST NOW TO INSTAGRAM"}
              </button>

              <button
                type="button"
                disabled={isSubmitting || isPostingMeta}
                onClick={confirmSchedule}
                className="flex items-center gap-2 rounded-lg bg-green-400 px-6 py-2.5 text-sm font-bold text-black shadow-md transition-colors hover:bg-green-500 disabled:opacity-50"
              >
                <CalendarCheck className="h-4 w-4" />
                {isSubmitting ? "SAVING TO AIRTABLE..." : "CONFIRM SCHEDULE"}
              </button>
            </div>
          </div>
        </div>

        {/* Confirm discard dialog */}
        {confirmDiscard && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/40 p-4"
            onClick={() => setConfirmDiscard(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border-4 border-black bg-white p-6 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xl font-medium text-black sm:text-2xl">
                Confirm <span className="font-extrabold">DISCARD?</span>
              </p>
              <div className="mt-5 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDiscard(false)
                    onClose()
                  }}
                  className="rounded-lg bg-green-400 px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-green-500"
                >
                  CONFIRM
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="rounded-lg bg-red-400 px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-red-500"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success message */}
        {showSuccess && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl border-4 border-black bg-white px-6 py-10 text-center shadow-2xl">
              <p className="text-xl font-bold italic text-black sm:text-2xl">
                {successTitle}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-stretch gap-2">
      <dt className="flex w-40 shrink-0 items-center justify-center rounded-lg bg-white px-2 py-2.5 text-center text-sm font-semibold text-black">
        {label}
      </dt>
      <dd
        className={`flex min-w-0 flex-1 items-center rounded-lg px-3 py-2.5 text-sm font-medium ${
          muted ? "bg-neutral-200 text-neutral-600" : "bg-white text-black"
        }`}
      >
        <span className="truncate">{value}</span>
      </dd>
    </div>
  )
}

