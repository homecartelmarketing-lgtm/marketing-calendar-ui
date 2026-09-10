"use client"

import { useEffect, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CloudUpload,
  Link2,
  Maximize2,
  Pencil,
  Share2,
  Trash2,
  Upload,
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

const STATUS_STYLES: Record<
  string,
  {
    bg: string
    border: string
    text: string
    dot: string
    hoverBg: string
  }
> = {
  Posted: {
    bg: "bg-emerald-50",
    border: "border-emerald-400",
    text: "text-emerald-800",
    dot: "bg-emerald-600",
    hoverBg: "hover:bg-emerald-100/70",
  },
  Scheduled: {
    bg: "bg-sky-50",
    border: "border-sky-400",
    text: "text-sky-800",
    dot: "bg-sky-600",
    hoverBg: "hover:bg-sky-100/70",
  },
  Completed: {
    bg: "bg-amber-50",
    border: "border-amber-400",
    text: "text-amber-800",
    dot: "bg-amber-600",
    hoverBg: "hover:bg-amber-100/70",
  },
  "For Manual": {
    bg: "bg-purple-50",
    border: "border-purple-400",
    text: "text-purple-800",
    dot: "bg-purple-600",
    hoverBg: "hover:bg-purple-100/70",
  },
  Discard: {
    bg: "bg-rose-50",
    border: "border-rose-400",
    text: "text-rose-800",
    dot: "bg-rose-600",
    hoverBg: "hover:bg-rose-100/70",
  },
}

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

  // Lightbox & Manual upload states
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [manualUploads, setManualUploads] = useState<Record<string, string[]>>({})
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null)
  const [zohoLinkNotes, setZohoLinkNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (lightboxOpen) {
          setLightboxOpen(false)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose, lightboxOpen])

  // Reset transient sub-states when navigating between items.
  useEffect(() => {
    setActiveSlide(0)
    setStatusOpen(false)
    setEditingCaption(false)
    setConfirmDiscard(false)
    setShowSuccess(false)
    setLightboxOpen(false)
    setUploadStatusText(null)
  }, [index])

  if (!item) return null

  const out = item.outputItem
  const status = statusByKey[item.key] ?? out?.status ?? "Completed"
  const caption = captionByKey[item.key] ?? out?.caption ?? ""
  const slides = out?.slides || []
  const manualSlides = manualUploads[item.key] || []
  const currentSlides = slides.length > 0 ? [...slides, ...manualSlides] : manualSlides
  const isVideo = out?.mediaType === "video" && Boolean(out?.videoUrl)

  const isStoriesOrReels = item.type === "Stories" || item.type === "Reels"
  const isDayAndNight =
    item.idea.toLowerCase().includes("day & night") ||
    item.idea.toLowerCase().includes("day and night") ||
    item.idea.toLowerCase().includes("d&n")
  const containerAspect = isStoriesOrReels
    ? "aspect-[9/16] max-w-[280px] sm:max-w-[320px]"
    : "aspect-[4/5] max-w-sm"

  function goPrev() {
    onIndexChange((index - 1 + items.length) % items.length)
  }
  function goNext() {
    onIndexChange((index + 1) % items.length)
  }

  async function handleManualUpload(file: File) {
    setIsUploading(true)
    setUploadStatusText("Uploading to Zoho Drive...")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("recordId", out?.recordId || "")
      fd.append("tableId", out?.tableId || "")
      fd.append("fixtureType", item.fixture || out?.fixtureType || "Chandelier")
      fd.append("notes", zohoLinkNotes[item.key] || "")
      fd.append("imageKind", activeSlide === 0 ? "Day" : "Night")

      const res = await fetch("/api/upload/zoho-drive", {
        method: "POST",
        body: fd,
      })

      const data = await res.json()
      if (res.ok && data.fileUrl) {
        setManualUploads((prev) => ({
          ...prev,
          [item.key]: [...(prev[item.key] || []), data.fileUrl],
        }))
        setUploadStatusText(
          data.zohoUploaded
            ? "✓ Uploaded to Zoho WorkDrive!"
            : "✓ Saved for manual review!"
        )
      } else {
        setUploadStatusText(`Upload error: ${data.message || "Failed"}`)
      }
    } catch (err: any) {
      setUploadStatusText(`Upload failed: ${err?.message || err}`)
    } finally {
      setIsUploading(false)
    }
  }

  async function confirmStatusChange() {
    setIsSubmitting(true)
    try {
      const finalStatus = status || "Completed"

      if (out?.recordId) {
        const patchRes = await fetch("/api/content-outputs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordId: out.recordId,
            tableId: out.tableId,
            status: finalStatus,
            notes: zohoLinkNotes[item.key] || undefined,
          }),
        })
        if (!patchRes.ok) {
          console.warn("Airtable status patch warning:", await patchRes.text())
        }
      }

      setStatusByKey((prev) => ({ ...prev, [item.key]: finalStatus }))
      onScheduleSuccess?.(item.key, finalStatus)
      setSuccessTitle(`STATUS UPDATED TO "${finalStatus.toUpperCase()}"!`)
      setShowSuccess(true)
      window.setTimeout(() => {
        setShowSuccess(false)
      }, 1500)
    } catch (err: any) {
      alert(`Failed to update status: ${err?.message || err}`)
    } finally {
      setIsSubmitting(false)
    }
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
          mediaUrl: currentSlides[0] || slides[0] || out?.videoUrl,
          slides: currentSlides.length > 0 ? currentSlides : slides,
          mediaType: isVideo ? "video" : "image",
        }),
      })

      if (!schedRes.ok) {
        const errData = await schedRes.json().catch(() => ({}))
        throw new Error(errData.error || errData.message || "Failed to save schedule to Airtable")
      }

      const schedData = await schedRes.json()
      savedEntry = schedData.entry

      setStatusByKey((prev) => ({ ...prev, [item.key]: finalStatus }))
      onScheduleSuccess?.(item.key, finalStatus, savedEntry)
      setSuccessTitle("SUCCESSFULLY UPDATED & SCHEDULED!")
      setShowSuccess(true)
      window.setTimeout(() => {
        setShowSuccess(false)
        onClose()
      }, 1600)
    } catch (err: any) {
      console.error("Error scheduling:", err)
      alert(`Scheduling Failed: ${err?.message || "Please verify your Airtable connection and permissions."}`)
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
          mediaUrls: currentSlides.length > 0 ? currentSlides : (mediaUrl ? [mediaUrl] : []),
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
            mediaUrl,
            slides: currentSlides.length > 0 ? currentSlides : (mediaUrl ? [mediaUrl] : []),
            mediaType: isVideo ? "video" : "image",
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

            <div
              className={`relative mx-auto ${containerAspect} w-full overflow-hidden rounded-xl border-2 border-neutral-800 bg-neutral-950 flex items-center justify-center group cursor-pointer`}
              onClick={() => setLightboxOpen(true)}
            >
              {isVideo ? (
                <video
                  src={out!.videoUrl}
                  controls
                  className="h-full w-full object-contain"
                />
              ) : currentSlides.length > 0 ? (
                <>
                  <img
                    src={currentSlides[activeSlide] || currentSlides[0]}
                    alt={`${item.idea} slide ${activeSlide + 1}`}
                    className="max-h-full max-w-full object-contain select-none"
                  />
                  {/* Click to expand hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30 pointer-events-none">
                    <span className="flex items-center gap-1.5 rounded-full bg-black/80 px-3.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg backdrop-blur-sm transition-opacity group-hover:opacity-100 pointer-events-auto">
                      <Maximize2 className="h-3.5 w-3.5 text-amber-400" />
                      Click for Full Photo
                    </span>
                  </div>

                  {currentSlides.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveSlide((prev) => (prev > 0 ? prev - 1 : currentSlides.length - 1))
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
                          setActiveSlide((prev) => (prev < currentSlides.length - 1 ? prev + 1 : 0))
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/90"
                        aria-label="Next slide"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2.5 right-2.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                        {activeSlide + 1} / {currentSlides.length}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <img
                  src="/placeholder.svg?height=760&width=570"
                  alt={`${item.idea} preview`}
                  className="max-h-full max-w-full object-contain"
                />
              )}

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-center text-white">
                <p className="text-base font-semibold sm:text-lg">
                  {item.idea}
                </p>
                {out?.itemNames?.[0] && (
                  <p className="mt-0.5 text-xs font-medium text-white/80">
                    {out.itemNames[0]}
                  </p>
                )}
                <p className="mt-1 text-[11px] leading-tight opacity-90">
                  Follow @HomeCartel for more home inspiration
                </p>
              </div>
            </div>

            {/* Quick Day & Night slide toggle buttons */}
            {isDayAndNight && currentSlides.length >= 2 && (
              <div className="mt-2.5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveSlide(0)
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeSlide === 0
                      ? "bg-amber-400 text-black shadow-sm"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  ☀️ Day Photo
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveSlide(1)
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeSlide === 1
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  🌙 Night Photo
                </button>
              </div>
            )}

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
                <DetailRow label="Content Name" value={item.idea} />
                {out?.itemNames && out.itemNames.length > 0 && (
                  <DetailRow label="Item Name" value={out.itemNames.join(", ")} />
                )}
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
                    {(() => {
                      const currentStyle = STATUS_STYLES[status] || {
                        bg: "bg-neutral-100",
                        border: "border-neutral-300",
                        text: "text-neutral-700",
                        dot: "bg-neutral-400",
                        hoverBg: "hover:bg-neutral-100",
                      }
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => setStatusOpen((o) => !o)}
                            aria-expanded={statusOpen}
                            className={`flex w-full items-center justify-between rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all shadow-sm ${currentStyle.bg} ${currentStyle.border} ${currentStyle.text}`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${currentStyle.dot} shadow-sm`}
                              />
                              <span className="truncate">{status}</span>
                            </span>
                            {statusOpen ? (
                              <ChevronUp
                                className="h-4 w-4 shrink-0 opacity-70"
                                strokeWidth={2.5}
                              />
                            ) : (
                              <ChevronDown
                                className="h-4 w-4 shrink-0 opacity-70"
                                strokeWidth={2.5}
                              />
                            )}
                          </button>
                          {statusOpen && (
                            <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-xl border-2 border-neutral-200 bg-white p-1.5 shadow-2xl backdrop-blur-sm">
                              <div className="flex flex-col gap-1">
                                {STATUS_OPTIONS.map((opt) => {
                                  const optStyle =
                                    STATUS_STYLES[opt] || currentStyle
                                  const isSelected = opt === status
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => {
                                        setStatusByKey((prev) => ({
                                          ...prev,
                                          [item.key]: opt,
                                        }))
                                        setStatusOpen(false)
                                      }}
                                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs sm:text-sm font-semibold transition-all ${
                                        isSelected
                                          ? `${optStyle.bg} ${optStyle.border} ${optStyle.text} ring-2 ring-neutral-400/30`
                                          : `border-transparent bg-transparent ${optStyle.text} ${optStyle.hoverBg}`
                                      }`}
                                    >
                                      <span className="flex items-center gap-2">
                                        <span
                                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${optStyle.dot}`}
                                        />
                                        <span>{opt}</span>
                                      </span>
                                      {isSelected && (
                                        <Check
                                          className="h-4 w-4 shrink-0 opacity-80"
                                          strokeWidth={2.5}
                                        />
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
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

            {/* "For Manual" Review & Zoho Drive Upload Section */}
            {status === "For Manual" && (
              <div className="rounded-2xl border-2 border-amber-500/40 bg-neutral-900 p-3 sm:p-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-amber-400">
                    <Upload className="h-4 w-4" />
                    Manual Review & Replacement Upload
                  </span>
                  {uploadStatusText && (
                    <span className="text-xs font-semibold text-amber-200">{uploadStatusText}</span>
                  )}
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      id={`manual-file-upload-${item.key}`}
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        await handleManualUpload(file)
                      }}
                    />
                    <label
                      htmlFor={`manual-file-upload-${item.key}`}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-amber-400/60 bg-amber-950/40 px-3 py-2.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-900/50"
                    >
                      <CloudUpload className="h-4 w-4" />
                      {isUploading ? "Uploading to Zoho WorkDrive..." : "Upload Replacement Photo to Zoho Drive"}
                    </label>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={zohoLinkNotes[item.key] || ""}
                      onChange={(e) =>
                        setZohoLinkNotes((prev) => ({ ...prev, [item.key]: e.target.value }))
                      }
                      placeholder="Zoho Drive folder link or revision notes..."
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none focus:border-amber-400"
                    />
                  </div>

                  {manualUploads[item.key] && manualUploads[item.key].length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      <span className="text-[11px] font-semibold text-neutral-400">Uploaded:</span>
                      {manualUploads[item.key].map((u, idx) => (
                        <div key={idx} className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-amber-400">
                          <img src={u} alt="Manual replacement" className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

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

              {status === "Scheduled" ? (
                <button
                  type="button"
                  disabled={isSubmitting || isPostingMeta}
                  onClick={confirmSchedule}
                  className="flex items-center gap-2 rounded-lg bg-green-400 px-6 py-2.5 text-sm font-bold text-black shadow-md transition-colors hover:bg-green-500 disabled:opacity-50"
                >
                  <CalendarCheck className="h-4 w-4" />
                  {isSubmitting ? "SAVING TO AIRTABLE..." : "CONFIRM SCHEDULE"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting || isPostingMeta}
                  onClick={confirmStatusChange}
                  className="flex items-center gap-2 rounded-lg bg-green-400 px-6 py-2.5 text-sm font-bold text-black shadow-md transition-colors hover:bg-green-500 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  {isSubmitting ? "SAVING STATUS..." : "CONFIRM"}
                </button>
              )}
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
                  CONFIRM DISCARD
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

        {/* Fullscreen High-Resolution Lightbox Overlay */}
        {lightboxOpen && currentSlides.length > 0 && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md"
            onClick={() => setLightboxOpen(false)}
          >
            <div
              className="relative flex max-h-[96vh] max-w-[96vw] flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                aria-label="Close full view"
                className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white hover:text-black"
              >
                <X className="h-6 w-6" strokeWidth={2.5} />
              </button>

              {/* Main full-resolution image */}
              <div className="relative overflow-hidden rounded-xl bg-neutral-950 shadow-2xl">
                <img
                  src={currentSlides[activeSlide] || currentSlides[0]}
                  alt={`${item.idea} full preview`}
                  className="max-h-[85vh] max-w-[90vw] object-contain"
                />

                {/* Left/Right navigation if multiple slides */}
                {currentSlides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSlide((prev) => (prev > 0 ? prev - 1 : currentSlides.length - 1))
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2.5 text-white backdrop-blur-md transition hover:bg-black"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSlide((prev) => (prev < currentSlides.length - 1 ? prev + 1 : 0))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2.5 text-white backdrop-blur-md transition hover:bg-black"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </>
                )}

                {/* Bottom slide pill indicator */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md">
                  {isDayAndNight
                    ? activeSlide === 0 ? "☀️ DAY PHOTO (1 / 2)" : "🌙 NIGHT PHOTO (2 / 2)"
                    : `SLIDE ${activeSlide + 1} OF ${currentSlides.length}`}
                </div>
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

