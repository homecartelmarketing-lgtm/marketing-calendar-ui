"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Pencil, Upload, X } from "lucide-react"
import { NAV_MENUS, type NavKey } from "@/lib/calendar-data"

export type ActiveContent = {
  category: "Feeds" | "Stories" | "Reels"
  type: string
}

const NAV_ITEMS: NavKey[] = ["Feeds", "Stories", "Reels"]

export function CalendarNav({
  onImportFile,
  importStatus,
  importError = false,
  onDismissStatus,
  activeContent,
  onSelectContent,
  onBackToCalendar,
}: {
  onImportFile: (file: File) => void
  importStatus?: string | null
  importError?: boolean
  onDismissStatus?: () => void
  activeContent?: ActiveContent | null
  onSelectContent?: (category: "Feeds" | "Stories" | "Reels", type: string) => void
  onBackToCalendar?: () => void
}) {
  const [openMenu, setOpenMenu] = useState<NavKey | null>(null)
  const [logo, setLogo] = useState("HomeCartel")
  const [editingLogo, setEditingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (editingLogo) logoInputRef.current?.focus()
  }, [editingLogo])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onImportFile(file)
    e.target.value = ""
  }

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <header
      ref={navRef}
      className="relative z-30 border-b border-white/60 bg-gradient-to-r from-black via-[#0a1a0a] to-black"
    >
      <nav className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-0 sm:px-8 sm:py-5">
        <div className="group flex items-center justify-center gap-2 sm:flex-1 sm:justify-start">
          {editingLogo ? (
            <input
              ref={logoInputRef}
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              onBlur={() => setEditingLogo(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") setEditingLogo(false)
              }}
              aria-label="Edit brand name"
              className="w-40 rounded-md border border-white/40 bg-transparent px-2 py-0.5 text-xl font-extrabold tracking-tight text-white outline-none focus:border-white sm:w-56 sm:text-2xl"
            />
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onBackToCalendar?.()}
                className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white transition-opacity hover:opacity-80 sm:text-2xl"
                aria-label="HomeCartel - Back to Calendar"
              >
                <span>
                  {logo}
                  <sup className="text-xs font-semibold">®</sup>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setEditingLogo(true)}
                aria-label="Edit brand name"
                className="opacity-70 transition-opacity hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-70"
              >
                <Pencil className="h-4 w-4 text-white" />
              </button>
            </div>
          )}
        </div>

        <ul className="flex items-center justify-center gap-6 sm:flex-1 sm:gap-16">
          {NAV_ITEMS.map((item) => {
            const isOpen = openMenu === item
            const isCategoryActive = activeContent?.category === item
            return (
              <li key={item} className="relative">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                  onClick={() => setOpenMenu(isOpen ? null : item)}
                  className={`flex items-center gap-2 text-base font-medium transition-opacity hover:opacity-80 sm:gap-6 sm:text-xl ${
                    isCategoryActive ? "text-pink-400 font-bold" : "text-white"
                  }`}
                >
                  {item}
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
                  ) : (
                    <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
                  )}
                </button>

                {isOpen && (
                  <div
                    role="menu"
                    className="absolute left-1/2 top-[calc(100%+1rem)] z-40 w-56 -translate-x-1/2 rounded-3xl bg-black py-4 text-center shadow-2xl ring-1 ring-white/10 sm:top-[calc(100%+1.25rem)] sm:w-64"
                  >
                    <ul className="flex flex-col">
                      {NAV_MENUS[item].map((option) => {
                        const isOptionActive =
                          activeContent?.category === item && activeContent?.type === option
                        return (
                          <li key={option}>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenu(null)
                                onSelectContent?.(item, option)
                              }}
                              className={`w-full px-5 py-2.5 text-left text-sm font-medium leading-tight transition-colors hover:bg-white/10 sm:text-base ${
                                isOptionActive
                                  ? "bg-white/15 text-pink-400 font-semibold"
                                  : "text-white"
                              }`}
                            >
                              {option}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <div className="hidden sm:block sm:flex-1" />
      </nav>

      <div className="absolute right-3 top-3 z-40 flex flex-col items-end gap-1 sm:right-8 sm:top-5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,text/csv"
          className="hidden"
          onChange={handleFile}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-80 sm:px-3 sm:text-sm"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Import Calendar</span>
          <span className="sm:hidden">Import</span>
        </button>

        {importStatus && (
          <div
            className={`flex max-w-[220px] items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium shadow-lg ${
              importError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
            }`}
          >
            <span className="truncate">{importStatus}</span>
            <button
              type="button"
              onClick={onDismissStatus}
              aria-label="Dismiss import status"
              className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
