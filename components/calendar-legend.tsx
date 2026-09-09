"use client"

import React from "react"

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {/* Category Legend Box (Outline Pills with Dot) */}
      <div className="flex flex-col gap-1 rounded-2xl border border-neutral-800 bg-[#0c0c0c] px-2.5 py-1.5 shadow-md">
        {/* Feeds */}
        <div className="flex items-center gap-1.5 rounded-full border border-yellow-400/80 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-yellow-300 sm:text-xs">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400 sm:h-2 sm:w-2" />
          <span>Feeds</span>
        </div>

        {/* Reels */}
        <div className="flex items-center gap-1.5 rounded-full border border-cyan-400/80 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 sm:text-xs">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400 sm:h-2 sm:w-2" />
          <span>Reels</span>
        </div>

        {/* Stories */}
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/80 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 sm:text-xs">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 sm:h-2 sm:w-2" />
          <span>Stories</span>
        </div>
      </div>

      {/* Status Legend Box (Filled Badges with Dot) */}
      <div className="flex flex-col gap-1 rounded-2xl border border-neutral-800 bg-[#0c0c0c] px-2.5 py-1.5 shadow-md">
        {/* Posted */}
        <div className="flex items-center gap-1.5 rounded-full bg-[#d1fae5] px-2.5 py-0.5 text-[10px] font-bold text-[#065f46] sm:text-xs">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#059669] sm:h-2 sm:w-2" />
          <span>Posted</span>
        </div>

        {/* Scheduled */}
        <div className="flex items-center gap-1.5 rounded-full bg-[#cffafe] px-2.5 py-0.5 text-[10px] font-bold text-[#155e75] sm:text-xs">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0891b2] sm:h-2 sm:w-2" />
          <span>Scheduled</span>
        </div>

        {/* Completed */}
        <div className="flex items-center gap-1.5 rounded-full bg-[#ffedd5] px-2.5 py-0.5 text-[10px] font-bold text-[#9a3412] sm:text-xs">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ea580c] sm:h-2 sm:w-2" />
          <span>Completed</span>
        </div>

        {/* Discard */}
        <div className="flex items-center gap-1.5 rounded-full bg-[#ffe4e6] px-2.5 py-0.5 text-[10px] font-bold text-[#9f1239] sm:text-xs">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#e11d48] sm:h-2 sm:w-2" />
          <span>Discard</span>
        </div>

        {/* For Manual */}
        <div className="flex items-center gap-1.5 rounded-full bg-[#ccfbf1] px-2.5 py-0.5 text-[10px] font-bold text-[#115e59] sm:text-xs">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0d9488] sm:h-2 sm:w-2" />
          <span>For Manual</span>
        </div>
      </div>
    </div>
  )
}
