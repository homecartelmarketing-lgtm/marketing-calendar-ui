"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Link as LinkIcon,
  MoreHorizontal,
  Calendar,
  Clock,
  RefreshCw,
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react"
import type { OutputItem } from "@/app/api/content-outputs/route"

const STATUS_OPTIONS = [
  "All Statuses",
  "Completed",
  "Scheduled",
  "Posted",
  "For Manual",
  "Discard",
] as const

type StatusFilter = (typeof STATUS_OPTIONS)[number]

const STATUS_BADGE_STYLES: Record<string, string> = {
  Completed: "border-amber-400 bg-amber-50 text-amber-600",
  Scheduled: "border-sky-400 bg-sky-50 text-sky-600",
  Posted: "border-emerald-500 bg-emerald-50 text-emerald-600",
  "For Manual": "border-purple-400 bg-purple-50 text-purple-600",
  Discard: "border-rose-400 bg-rose-50 text-rose-600",
}

export function UniversalContentGallery({
  category,
  contentType,
  onBackToCalendar,
}: {
  category: "Feeds" | "Stories" | "Reels"
  contentType: string
  onBackToCalendar: () => void
}) {
  const [items, setItems] = useState<OutputItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("All Statuses")
  const [filterOpen, setFilterOpen] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/content-outputs?category=${encodeURIComponent(category)}&type=${encodeURIComponent(contentType)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load automation outputs")
      const data = await res.json()
      setItems(data.items || [])
    } catch (err: any) {
      setError(err?.message || "Failed to fetch outputs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPageIndex(0)
    setSelectedStatus("All Statuses")
    loadData()
  }, [category, contentType])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      return selectedStatus === "All Statuses" || item.status === selectedStatus
    })
  }, [items, selectedStatus])

  // 3 cards per view on desktop
  const CARDS_PER_PAGE = 3
  const maxPage = Math.max(0, Math.ceil(filteredItems.length / CARDS_PER_PAGE) - 1)

  const visibleItems = useMemo(() => {
    const start = pageIndex * CARDS_PER_PAGE
    return filteredItems.slice(start, start + CARDS_PER_PAGE)
  }, [filteredItems, pageIndex])

  function handlePrev() {
    setPageIndex((prev) => Math.max(0, prev - 1))
  }

  function handleNext() {
    setPageIndex((prev) => Math.min(maxPage, prev + 1))
  }

  // Format title cleanly
  const formattedTitle = useMemo(() => {
    if (category === "Stories" && contentType.toLowerCase().includes("cta")) {
      return "CTA Stories"
    }
    if (category === "Stories" && contentType.toLowerCase().endsWith("story")) {
      return `${contentType.replace(/story$/i, "").trim()} Stories`
    }
    return `${contentType} ${category}`
  }, [category, contentType])

  return (
    <main className="min-h-screen bg-white pb-24 text-black">
      {/* Top Bar: Back to calendar & Refresh */}
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 pt-6 sm:px-8">
        <button
          type="button"
          onClick={onBackToCalendar}
          className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Calendar</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
            {category === "Feeds" ? "4:5 Carousel" : category === "Stories" ? "9:16 Story" : "9:16 Video Reel"}
          </span>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 sm:text-sm disabled:opacity-50"
            title="Refresh outputs from Airtable"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Sync Airtable</span>
          </button>
        </div>
      </div>

      {/* Header Title with Pink/Purple Gradient */}
      <div className="mx-auto max-w-[1500px] px-4 pt-6 sm:px-8">
        <div className="relative flex flex-col items-center justify-center">
          <h1 className="bg-gradient-to-r from-[#ff3366] via-[#d926a9] to-[#802bb1] bg-clip-text text-center text-3xl font-extrabold tracking-tight text-transparent sm:text-5xl">
            {formattedTitle}
          </h1>
          <div className="mt-3 h-0.5 w-32 bg-neutral-300 sm:w-64" />

          {/* Filter dropdown at top right */}
          <div className="relative mt-4 flex w-full justify-end sm:absolute sm:right-0 sm:top-0 sm:mt-0">
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-neutral-800 sm:text-sm"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{selectedStatus}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-48 rounded-xl border border-neutral-200 bg-white py-1 shadow-2xl">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setSelectedStatus(opt)
                      setPageIndex(0)
                      setFilterOpen(false)
                    }}
                    className={`block w-full px-4 py-2 text-left text-xs font-medium transition hover:bg-neutral-100 sm:text-sm ${
                      selectedStatus === opt ? "bg-neutral-50 font-bold text-black" : "text-neutral-700"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Gallery Cards Container */}
      <div className="mx-auto mt-10 max-w-[1500px] px-4 sm:px-8">
        {loading ? (
          <div className="flex h-96 flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-neutral-500" />
            <p className="text-sm font-medium text-neutral-500">Loading automation outputs...</p>
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm font-semibold text-red-600">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="rounded-md bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
            >
              Retry
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
              <Filter className="h-6 w-6" />
            </div>
            <p className="text-lg font-bold text-neutral-800">No outputs generated yet for {formattedTitle}</p>
            <p className="max-w-md text-xs text-neutral-500">
              {selectedStatus !== "All Statuses"
                ? `No records found with status "${selectedStatus}". Try changing your filter.`
                : "Outputs will appear here automatically as soon as you run the automation script for this content type."}
            </p>
            <button
              type="button"
              onClick={loadData}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Check for Updates</span>
            </button>
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 gap-6 ${
              category === "Feeds"
                ? "md:grid-cols-2 lg:grid-cols-3"
                : "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3"
            }`}
          >
            {visibleItems.map((item) => (
              <ContentCard key={item.recordId} item={item} category={category} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Center Navigation Pill */}
      {filteredItems.length > CARDS_PER_PAGE && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-1 rounded-full bg-black/90 px-3 py-1.5 shadow-2xl backdrop-blur-md">
            <button
              type="button"
              onClick={handlePrev}
              disabled={pageIndex === 0}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/20 disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="px-2 text-xs font-medium text-white/80">
              {pageIndex + 1} / {maxPage + 1}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={pageIndex >= maxPage}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/20 disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

function ContentCard({ item, category }: { item: OutputItem; category: "Feeds" | "Stories" | "Reels" }) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [showFullCaption, setShowFullCaption] = useState(false)
  const slides = item.slides || []
  const isVideo = item.mediaType === "video" && Boolean(item.videoUrl)
  const aspectClass = category === "Feeds" ? "aspect-[4/5]" : "aspect-[9/16]"

  function handlePrevSlide(e: React.MouseEvent) {
    e.stopPropagation()
    setActiveSlide((prev) => (prev > 0 ? prev - 1 : slides.length - 1))
  }

  function handleNextSlide(e: React.MouseEvent) {
    e.stopPropagation()
    setActiveSlide((prev) => (prev < slides.length - 1 ? prev + 1 : 0))
  }

  const badgeClass =
    STATUS_BADGE_STYLES[item.status] || "border-neutral-300 bg-neutral-100 text-neutral-700"

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md">
      {/* Header: Profile avatar ("HC"), "Home Cartel" / "Marketing", ... menu */}
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-[11px] font-black tracking-tight text-white">
            HC
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-tight text-neutral-900">Home Cartel</span>
            <span className="text-[11px] leading-tight text-neutral-500">Marketing</span>
          </div>
        </div>
        <button
          type="button"
          className="text-neutral-400 transition hover:text-neutral-700"
          aria-label="More options"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Media Display: 4:5 for Feeds, 9:16 for Stories & Video Reels */}
      <div className={`relative ${aspectClass} w-full select-none overflow-hidden bg-neutral-950`}>
        {isVideo ? (
          <VideoPlayer videoUrl={item.videoUrl!} duration={item.duration} />
        ) : slides.length > 0 ? (
          <>
            <img
              src={slides[activeSlide]}
              alt={`Slide ${activeSlide + 1} for ${item.foreignKeyId}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevSlide}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-80 backdrop-blur-sm transition hover:bg-black/80 hover:opacity-100"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-80 backdrop-blur-sm transition hover:bg-black/80 hover:opacity-100"
                  aria-label="Next slide"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm shadow-sm">
                  {activeSlide + 1} / {slides.length}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
            No media asset
          </div>
        )}
      </div>

      {/* Card Details */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        {/* Status Badge + Slide Dots + Non-clickable Link button */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
          >
            {item.status}
          </span>

          {/* Slide dots for multi-slide content */}
          {slides.length > 1 && (
            <div className="flex items-center gap-1.5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveSlide(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === activeSlide ? "w-3 bg-sky-500" : "w-1.5 bg-neutral-300 hover:bg-neutral-400"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}

          {/* Non-clickable Link button */}
          <button
            type="button"
            disabled
            className="flex cursor-default select-none items-center gap-1 rounded-full border border-black px-2.5 py-0.5 text-xs font-bold text-black"
          >
            <LinkIcon className="h-3 w-3" />
            <span>Link</span>
          </button>
        </div>

        {/* CID / Foreign Key ID + Optional Fixture Badge */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-tight text-neutral-900 sm:text-sm">
            {item.foreignKeyId}
          </span>
          {item.fixtureType && (
            <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
              {item.fixtureType}
            </span>
          )}
        </div>

        {/* Date and Time generated (Only rendered if present in Airtable) */}
        {Boolean(item.date && item.time) && (
          <div className="mt-2 flex flex-col gap-1 text-[11px] text-neutral-600 sm:text-xs">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-neutral-700" />
              <span>{item.date}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-neutral-700" />
              <span>{item.time}</span>
            </div>
          </div>
        )}

        {/* Smart Caption Area (Only rendered if present in Airtable) */}
        {Boolean(item.caption && item.caption.trim()) && (
          <div className="mt-3 min-h-[40px] flex-1 border-t border-neutral-100 pt-2 text-xs leading-relaxed text-neutral-700">
            <div>
              <p
                className={`whitespace-pre-line text-neutral-800 ${
                  showFullCaption ? "" : "line-clamp-3"
                }`}
              >
                {item.caption}
              </p>
              {item.caption.length > 120 && (
                <button
                  type="button"
                  onClick={() => setShowFullCaption(!showFullCaption)}
                  className="mt-1 text-[11px] font-bold text-blue-600 hover:underline"
                >
                  {showFullCaption ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function VideoPlayer({ videoUrl, duration }: { videoUrl: string; duration?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)

  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation()
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation()
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  return (
    <div className="relative h-full w-full cursor-pointer" onClick={togglePlay}>
      <video
        ref={videoRef}
        src={videoUrl}
        loop
        playsInline
        muted={isMuted}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="h-full w-full object-cover"
      />

      {/* Duration Badge */}
      {duration && (
        <span className="absolute left-2.5 top-2.5 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          {duration}
        </span>
      )}

      {/* Play/Pause Overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition hover:scale-105">
            <Play className="h-6 w-6 fill-current pl-1" />
          </div>
        </div>
      )}

      {/* Bottom Mute button */}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute bottom-2.5 right-2.5 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm hover:bg-black/80"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  )
}
