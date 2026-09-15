"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  Play,
  RefreshCw,
  Server,
  AlertTriangle,
  XCircle,
  Database,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Upload,
  Image as ImageIcon,
  Send,
  Link2,
} from "lucide-react"

const DIAGNOSTICS_REQUEST_TIMEOUT_MS = 25_000

function InstagramIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

interface SystemDiagnostics {
  serverUtc: string
  phtNow: string
  cronSecretConfigured: boolean
  airtableConfigured: boolean
  airtableStatus?: "not_configured" | "checking" | "connected" | "disconnected"
  airtableBaseId: string
  scheduleScanStatus?: "complete" | "timed_out"
  metaStatus: {
    configured: boolean
    verified: boolean
    username?: string
    name?: string
    id?: string
    error?: string
  }
  failedTablesCount?: number
  failedTables?: any[]
}

interface ScheduledItem {
  recordId: string
  tableId: string
  isoDate: string
  rowKey: string
  category: "Feeds" | "Reels" | "Stories"
  idea: string
  time: string | null
  fixture?: string
  foreignKeyId: string
  status: string
  caption?: string
  airtableUrl?: string
  itemNames?: string[]
  mediaUrl?: string
  slides?: string[]
  mediaType?: "image" | "video"
  phtScheduledString: string
  isOverdue: boolean
  diffMinutes: number
  hasMedia: boolean
}

interface CandidateFixture {
  recordId: string
  tableId: string
  category: string
  idea: string
  itemName: string
  mediaUrl: string
  status: string
}

export default function SchedulerDebugPage() {
  const [system, setSystem] = useState<SystemDiagnostics | null>(null)
  const [scheduledItems, setScheduledItems] = useState<ScheduledItem[]>([])
  const [scheduledCount, setScheduledCount] = useState<number>(0)
  const [candidateFixtures, setCandidateFixtures] = useState<CandidateFixture[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null)
  const [runnerExecuting, setRunnerExecuting] = useState(false)
  const [runnerResult, setRunnerResult] = useState<any | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [showRawJson, setShowRawJson] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>("")

  // Test Scheduler Form State
  const [mediaSourceType, setMediaSourceType] = useState<"catalog" | "upload" | "url">("catalog")
  const [selectedFixture, setSelectedFixture] = useState<CandidateFixture | null>(null)
  const [customMediaUrl, setCustomMediaUrl] = useState("")
  const [customCaption, setCustomCaption] = useState("Home Cartel test post #modernlighting #interiordesign")
  const [postCategory, setPostCategory] = useState<"Stories" | "Feeds">("Stories")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null)
  const [testActionLoading, setTestActionLoading] = useState(false)
  const [testActionResult, setTestActionResult] = useState<{
    success: boolean
    message: string
    details?: any
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize Default Schedule Time (Now + 2 minutes in PHT)
  useEffect(() => {
    const target = new Date(Date.now() + 2 * 60000)
    const isoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(target)
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(target)
    setScheduledDate(isoDate)
    setScheduledTime(time)
  }, [])

  const setOffsetTime = (mins: number) => {
    const target = new Date(Date.now() + mins * 60000)
    const isoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(target)
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(target)
    setScheduledDate(isoDate)
    setScheduledTime(time)
  }

  const inFlightRef = useRef(false)
  const loadDiagnostics = useCallback(async (isSilent = false) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    if (!isSilent) setRefreshing(true)
    const controller = new AbortController()
    const requestTimeout = setTimeout(() => controller.abort(), DIAGNOSTICS_REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch("/api/scheduler-debug", {
        cache: "no-store",
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Diagnostics request failed (${res.status})`)
      const data = await res.json()
      if (!data.success || !data.system) throw new Error("Diagnostics response was incomplete")
      setDiagnosticsError(null)
      setSystem(data.system)
      setScheduledItems(data.scheduledItems || [])
      setScheduledCount(data.scheduledCount || 0)
      if (data.candidateFixtures && data.candidateFixtures.length > 0) {
        setCandidateFixtures(data.candidateFixtures)
        if (!selectedFixture) {
          setSelectedFixture(data.candidateFixtures[0])
        }
      }
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      console.error("Failed to load scheduler debug data:", err)
      setDiagnosticsError("Diagnostics check failed. Refresh to retry.")
    } finally {
      clearTimeout(requestTimeout)
      inFlightRef.current = false
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedFixture])

  useEffect(() => {
    loadDiagnostics()
  }, [loadDiagnostics])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => {
      loadDiagnostics(true)
    }, 20000)
    return () => clearInterval(timer)
  }, [autoRefresh, loadDiagnostics])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    setTestActionResult(null)

    // Local object URL for instant UI preview
    const objectUrl = URL.createObjectURL(file)
    setUploadedPreview(objectUrl)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/scheduler-debug/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.fullUrl) {
        setCustomMediaUrl(data.fullUrl)
        setTestActionResult({
          success: true,
          message: `Photo uploaded! Public URL: ${data.fullUrl}`,
        })
      } else {
        setTestActionResult({
          success: false,
          message: data.error || "File upload failed",
        })
      }
    } catch (err: any) {
      setTestActionResult({
        success: false,
        message: `Upload error: ${err?.message || err}`,
      })
    } finally {
      setUploadingFile(false)
    }
  }

  const effectiveMediaUrl =
    mediaSourceType === "catalog"
      ? selectedFixture?.mediaUrl || ""
      : mediaSourceType === "upload"
      ? customMediaUrl || uploadedPreview || ""
      : customMediaUrl

  // Action 1: Post Immediately to Instagram
  const handleImmediatePost = async () => {
    if (!effectiveMediaUrl) {
      alert("Please upload a photo, choose one from the catalog, or enter an image URL.")
      return
    }

    setTestActionLoading(true)
    setTestActionResult(null)

    try {
      const res = await fetch("/api/scheduler-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-post-now",
          mediaUrl: effectiveMediaUrl,
          caption: customCaption,
          category: postCategory,
          tableId: selectedFixture?.tableId,
          recordId: selectedFixture?.recordId,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setTestActionResult({
          success: true,
          message: `SUCCESS! Published to Instagram (@${system?.metaStatus?.username || "homecartel"})! Post ID: ${data.publishId}`,
          details: data,
        })
        await loadDiagnostics(true)
      } else {
        setTestActionResult({
          success: false,
          message: `Instagram Publish Failed: ${data.error || data.message || "Unknown error"}`,
          details: data,
        })
      }
    } catch (err: any) {
      setTestActionResult({
        success: false,
        message: `Error: ${err?.message || err}`,
      })
    } finally {
      setTestActionLoading(false)
    }
  }

  // Action 2: Schedule Post for Runner Execution
  const handleSchedulePost = async () => {
    if (!effectiveMediaUrl) {
      alert("Please select or upload a photo.")
      return
    }
    if (!scheduledDate || !scheduledTime) {
      alert("Please specify scheduled date and time.")
      return
    }

    setTestActionLoading(true)
    setTestActionResult(null)

    try {
      // If we have a fixture selected from catalog, update that record
      const targetTableId = selectedFixture?.tableId || "tblfl7fqFZa2vUieB"
      const targetRecordId = selectedFixture?.recordId || "recOCbbR7npjEewye"

      const res = await fetch("/api/scheduler-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule-new-item",
          tableId: targetTableId,
          recordId: targetRecordId,
          isoDate: scheduledDate,
          time: scheduledTime,
          category: postCategory,
          caption: customCaption,
          mediaUrl: effectiveMediaUrl,
        }),
      })

      const data = await res.json()
      if (data.success) {
        // Check if scheduled time is due right now
        const scheduledPhtDate = new Date(`${scheduledDate}T${scheduledTime}:00+08:00`)
        const isDueNow = Date.now() >= scheduledPhtDate.getTime()

        if (isDueNow) {
          setTestActionResult({
            success: true,
            message: `SCHEDULED & DUE NOW! Tagged in Airtable for ${scheduledDate} ${scheduledTime} PHT. Auto-triggering runner engine to publish to Instagram...`,
          })
          // Automatically trigger runner so user sees it publish right away
          await handleTriggerRunner()
        } else {
          setTestActionResult({
            success: true,
            message: `SCHEDULED! Tagged item in Airtable for ${scheduledDate} at ${scheduledTime} PHT. Queued in Airtable and will be published automatically when due!`,
            details: data,
          })
          await loadDiagnostics(true)
        }
      } else {
        setTestActionResult({
          success: false,
          message: `Failed to schedule: ${data.error || "Airtable update failed"}`,
          details: data,
        })
      }
    } catch (err: any) {
      setTestActionResult({
        success: false,
        message: `Error: ${err?.message || err}`,
      })
    } finally {
      setTestActionLoading(false)
    }
  }

  const handleTriggerRunner = async () => {
    setRunnerExecuting(true)
    setRunnerResult(null)
    try {
      const res = await fetch("/api/scheduler-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger-runner" }),
      })
      const data = await res.json()
      setRunnerResult(data)
      await loadDiagnostics(true)
    } catch (err: any) {
      setRunnerResult({
        success: false,
        error: err?.message || "Failed to trigger runner",
      })
    } finally {
      setRunnerExecuting(false)
    }
  }

  const handleQuickReschedule = async (tableId: string, recordId: string, minutes: number) => {
    setActionLoadingId(`${recordId}-reschedule`)
    try {
      const res = await fetch("/api/scheduler-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quick-reschedule",
          tableId,
          recordId,
          minutesFromNow: minutes,
        }),
      })
      if (res.ok) {
        await loadDiagnostics(true)
      } else {
        const d = await res.json()
        alert(`Reschedule failed: ${d.error || "Unknown error"}`)
      }
    } catch (err: any) {
      alert(`Error: ${err?.message || err}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleSetStatus = async (tableId: string, recordId: string, status: string) => {
    if (!confirm(`Are you sure you want to change record status to '${status}'?`)) return
    setActionLoadingId(`${recordId}-status`)
    try {
      const res = await fetch("/api/scheduler-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-status",
          tableId,
          recordId,
          status,
        }),
      })
      if (res.ok) {
        await loadDiagnostics(true)
      }
    } catch (err: any) {
      alert(`Error: ${err?.message || err}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Calendar
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Instagram Scheduler Test Bench & Live Diagnostics
                </h1>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Upload photos, test schedule timings, verify Meta Graph API publishing, and monitor the live queue.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-xs px-3 py-1.5 rounded-md border transition flex items-center gap-1.5 ${
                autoRefresh
                  ? "bg-emerald-950/60 border-emerald-700/50 text-emerald-300"
                  : "bg-neutral-900 border-neutral-800 text-neutral-400"
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              Auto-sync: {autoRefresh ? "ON (20s)" : "OFF"}
            </button>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => loadDiagnostics()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 border border-neutral-800 text-xs font-semibold text-neutral-200 hover:bg-neutral-800 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {lastUpdated && (
              <span className="text-[11px] text-neutral-500">
                Synced at {lastUpdated}
              </span>
            )}
          </div>
        </header>

        {/* System Health Cards Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Meta API Card */}
          <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-5 backdrop-blur-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <InstagramIcon className="h-4 w-4 text-pink-500" />
                Meta Graph API
              </span>
              {diagnosticsError && !system ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-950/80 border border-red-700/50 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                  CHECK FAILED
                </span>
              ) : loading && !system ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/80 border border-blue-700/50 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                  <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />
                  CHECKING...
                </span>
              ) : system?.metaStatus?.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-700/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  VERIFIED LIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-950/80 border border-red-700/50 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                  <XCircle className="h-3 w-3 text-red-400" />
                  UNVERIFIED
                </span>
              )}
            </div>

            <div className="mt-3">
              {diagnosticsError && !system ? (
                <div className="text-xs text-red-300">{diagnosticsError}</div>
              ) : loading && !system ? (
                <div className="text-xs text-neutral-400">Verifying Meta Graph API connection...</div>
              ) : system?.metaStatus?.verified ? (
                <div>
                  <div className="text-base font-bold text-white flex items-center gap-1.5">
                    @{system.metaStatus.username}
                  </div>
                  <div className="text-xs text-neutral-400 truncate">
                    {system.metaStatus.name || "Instagram Account"}
                  </div>
                  <div className="mt-2 text-[11px] text-neutral-500 font-mono">
                    ID: {system.metaStatus.id}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-red-300 mt-1">
                  {system?.metaStatus?.error || "Meta credentials missing or invalid."}
                </div>
              )}
            </div>
          </div>

          {/* CRON_SECRET Card */}
          <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-amber-500" />
                Runner Security
              </span>
              {diagnosticsError && !system ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-950/80 border border-red-700/50 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                  CHECK FAILED
                </span>
              ) : loading && !system ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/80 border border-blue-700/50 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                  <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />
                  CHECKING...
                </span>
              ) : system?.cronSecretConfigured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-700/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  ACTIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-950/80 border border-red-700/50 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                  MISSING
                </span>
              )}
            </div>

            <div className="mt-3">
              <div className="text-xs text-neutral-400">CRON_SECRET Token:</div>
              <div className="font-mono text-sm font-semibold text-amber-300 truncate mt-0.5">
                {diagnosticsError && !system
                  ? "Unavailable"
                  : loading && !system
                    ? "Checking..."
                    : system?.cronSecretConfigured
                      ? "Configured"
                      : "Not configured"}
              </div>
              <div className="mt-2 text-[11px] text-neutral-500">
                Secured via Vercel Pro Cron
              </div>
            </div>
          </div>

          {/* Airtable Base Card */}
          <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Database className="h-4 w-4 text-sky-500" />
                Airtable Base
              </span>
              {diagnosticsError && !system ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-950/80 border border-red-700/50 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                  CHECK FAILED
                </span>
              ) : loading && !system ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/80 border border-blue-700/50 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                  <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />
                  CHECKING...
                </span>
              ) : system?.airtableStatus === "checking" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/80 border border-blue-700/50 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                  <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />
                  CHECKING...
                </span>
              ) : system?.airtableStatus === "connected" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-700/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  CONNECTED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-950/80 border border-red-700/50 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                  DISCONNECTED
                </span>
              )}
            </div>

            <div className="mt-3">
              <div className="text-xs text-neutral-400">Base ID:</div>
              <div className="font-mono text-sm font-semibold text-sky-300 truncate mt-0.5">
                {loading && !system ? "Connecting..." : (system?.airtableBaseId || "None")}
              </div>
              <div className="mt-2 text-[11px] text-neutral-500">
                {system?.scheduleScanStatus === "timed_out"
                  ? "Schedule scan is still running; auto-sync will retry"
                  : "79 configured table endpoints"}
              </div>
            </div>
          </div>

          {/* Clock Card (Asia/Manila) */}
          <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-purple-500" />
                Scheduler Clock (PHT)
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-950/80 border border-purple-700/50 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                UTC+08:00
              </span>
            </div>

            <div className="mt-3">
              <div className="text-sm font-bold text-white tracking-wide">
                {system?.phtNow || "Loading..."}
              </div>
              <div className="mt-2 text-[11px] text-neutral-500 truncate font-mono">
                Server UTC: {system?.serverUtc?.slice(11, 19)}Z
              </div>
            </div>
          </div>

        </section>

        {/* ========================================================================= */}
        {/* NEW: INTERACTIVE PHOTO SCHEDULER & TEST LAB */}
        {/* ========================================================================= */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 backdrop-blur-md shadow-2xl">
          <div className="border-b border-neutral-800 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">
                  Live Instagram Scheduler Test Lab
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-950/80 border border-amber-800/60 text-amber-300">
                  Interactive Testing
                </span>
              </div>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Upload any photo or pick from the catalog, configure a scheduled time or test immediate posting, and observe the live result on Instagram.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Photo Selection (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-sky-400" />
                  1. Choose Photo
                </label>
                
                {/* Source Tabs */}
                <div className="flex items-center rounded-lg bg-neutral-950 p-1 border border-neutral-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setMediaSourceType("catalog")}
                    className={`px-3 py-1 rounded-md transition font-medium ${
                      mediaSourceType === "catalog"
                        ? "bg-neutral-800 text-white shadow-sm"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Catalog Items ({candidateFixtures.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaSourceType("upload")}
                    className={`px-3 py-1 rounded-md transition font-medium ${
                      mediaSourceType === "upload"
                        ? "bg-neutral-800 text-white shadow-sm"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Upload Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaSourceType("url")}
                    className={`px-3 py-1 rounded-md transition font-medium ${
                      mediaSourceType === "url"
                        ? "bg-neutral-800 text-white shadow-sm"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Image URL
                  </button>
                </div>
              </div>

              {/* Tab 1: Catalog Picker */}
              {mediaSourceType === "catalog" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                    {candidateFixtures.map((fix) => {
                      const isSelected = selectedFixture?.recordId === fix.recordId
                      return (
                        <div
                          key={fix.recordId}
                          onClick={() => setSelectedFixture(fix)}
                          className={`group cursor-pointer rounded-xl border p-2 transition relative flex flex-col items-center ${
                            isSelected
                              ? "border-sky-500 bg-sky-950/30 ring-2 ring-sky-500/50"
                              : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700"
                          }`}
                        >
                          <div className="h-20 w-full rounded-lg overflow-hidden bg-neutral-900 relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={fix.mediaUrl}
                              alt={fix.itemName}
                              className="h-full w-full object-cover group-hover:scale-105 transition"
                            />
                            {isSelected && (
                              <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-sky-500 flex items-center justify-center">
                                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="mt-2 text-center w-full">
                            <div className="text-[11px] font-bold text-white truncate">
                              {fix.itemName}
                            </div>
                            <div className="text-[10px] text-neutral-500 truncate">
                              {fix.category} • {fix.idea}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {candidateFixtures.length === 0 && (
                    <div className="py-8 text-center text-xs text-neutral-500">
                      Loading catalog items...
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Upload File */}
              {mediaSourceType === "upload" && (
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-neutral-700 hover:border-sky-500 hover:bg-neutral-900/50 transition cursor-pointer rounded-xl p-6 text-center flex flex-col items-center justify-center gap-2"
                  >
                    <div className="h-12 w-12 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-300">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="text-xs font-semibold text-white">
                      Click or drag a photo here to upload
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      Supports JPG, PNG, WEBP (Max 10MB)
                    </div>
                  </div>

                  {uploadingFile && (
                    <div className="text-xs text-sky-400 flex items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Uploading photo to public test server...
                    </div>
                  )}

                  {uploadedPreview && (
                    <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center gap-3">
                      <div className="h-14 w-14 rounded overflow-hidden bg-neutral-900 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={uploadedPreview} alt="preview" className="h-full w-full object-cover" />
                      </div>
                      <div className="text-xs overflow-hidden">
                        <div className="text-white font-medium truncate">Uploaded Photo Ready</div>
                        <div className="text-[10px] text-neutral-400 truncate mt-0.5 font-mono">
                          {customMediaUrl || "Ready to schedule"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Direct URL */}
              {mediaSourceType === "url" && (
                <div className="space-y-2">
                  <div className="relative">
                    <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                    <input
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      value={customMediaUrl}
                      onChange={(e) => setCustomMediaUrl(e.target.value)}
                      className="w-full rounded-lg bg-neutral-950 border border-neutral-800 pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Must be a direct, publicly reachable image link (HTTPS) that Meta can download.
                  </p>
                </div>
              )}

              {/* Caption Input */}
              <div className="pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block mb-1.5">
                  2. Caption
                </label>
                <textarea
                  rows={2}
                  value={customCaption}
                  onChange={(e) => setCustomCaption(e.target.value)}
                  placeholder="Enter Instagram post caption..."
                  className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-sky-500 resize-none"
                />
              </div>

            </div>

            {/* Right Column: Timing, Preview & Publish Buttons (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4 bg-neutral-950/70 p-5 rounded-xl border border-neutral-800">
              
              <div className="space-y-4">
                
                {/* Category & Preview */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block mb-1.5">
                    3. Format & Schedule Time (PHT)
                  </label>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPostCategory("Stories")}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                        postCategory === "Stories"
                          ? "bg-pink-950/80 border-pink-700/60 text-pink-300"
                          : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      <InstagramIcon className="h-3.5 w-3.5 text-pink-400" />
                      Instagram Story
                    </button>

                    <button
                      type="button"
                      onClick={() => setPostCategory("Feeds")}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                        postCategory === "Feeds"
                          ? "bg-blue-950/80 border-blue-700/60 text-blue-300"
                          : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      <InstagramIcon className="h-3.5 w-3.5 text-blue-400" />
                      Instagram Feed
                    </button>
                  </div>
                </div>

                {/* Date & Time Inputs */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-neutral-400 font-semibold block mb-1">Date (PHT)</span>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 font-semibold block mb-1">Time (24h PHT)</span>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Quick offset buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-neutral-500">Quick Presets:</span>
                    <button
                      type="button"
                      onClick={() => setOffsetTime(1)}
                      className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-semibold text-sky-400 transition"
                    >
                      +1 min
                    </button>
                    <button
                      type="button"
                      onClick={() => setOffsetTime(2)}
                      className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-semibold text-sky-400 transition"
                    >
                      +2 mins
                    </button>
                    <button
                      type="button"
                      onClick={() => setOffsetTime(5)}
                      className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[10px] font-semibold text-sky-400 transition"
                    >
                      +5 mins
                    </button>
                  </div>
                </div>

                {/* Live Media Thumbnail Preview */}
                {effectiveMediaUrl && (
                  <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center gap-3">
                    <div className="h-16 w-16 rounded-md overflow-hidden bg-black shrink-0 border border-neutral-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={effectiveMediaUrl} alt="selected" className="h-full w-full object-cover" />
                    </div>
                    <div className="text-xs overflow-hidden">
                      <div className="text-[10px] text-emerald-400 font-bold uppercase">Ready to publish</div>
                      <div className="text-white font-medium truncate mt-0.5">
                        {selectedFixture?.itemName || "Custom Test Image"}
                      </div>
                      <div className="text-[10px] text-neutral-500 truncate font-mono mt-0.5">
                        Target: {scheduledDate} at {scheduledTime} PHT
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-3 border-t border-neutral-800">
                
                {/* Button 1: Immediate Test Post to Instagram */}
                <button
                  type="button"
                  disabled={testActionLoading || !effectiveMediaUrl}
                  onClick={handleImmediatePost}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#f09433] via-[#e6683c] to-[#bc1888] hover:opacity-95 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50"
                >
                  {testActionLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      PUBLISHING TO INSTAGRAM...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      TEST POST NOW TO INSTAGRAM
                    </>
                  )}
                </button>

                {/* Button 2: Save Schedule in Airtable for Runner */}
                <button
                  type="button"
                  disabled={testActionLoading || !effectiveMediaUrl}
                  onClick={handleSchedulePost}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  SAVE SCHEDULE & QUEUE FOR RUNNER
                </button>
              </div>

            </div>

          </div>

          {/* Test Action Notification Banner */}
          {testActionResult && (
            <div
              className={`mt-4 p-4 rounded-xl border text-xs flex items-start gap-3 ${
                testActionResult.success
                  ? "bg-emerald-950/70 border-emerald-800 text-emerald-200"
                  : "bg-red-950/70 border-red-800 text-red-200"
              }`}
            >
              {testActionResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold">{testActionResult.message}</div>
                {testActionResult.details && (
                  <div className="mt-1 font-mono text-[11px] text-neutral-300">
                    {typeof testActionResult.details === "object"
                      ? JSON.stringify(testActionResult.details)
                      : testActionResult.details}
                  </div>
                )}
              </div>
            </div>
          )}

        </section>

        {/* Runner Test Execution Panel */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 backdrop-blur-md shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Server className="h-5 w-5 text-indigo-400" />
                Instant Runner Execution Test
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Trigger the exact backend runner endpoint (`/api/schedules/runner`) using the authenticated Bearer token.
              </p>
            </div>

            <button
              type="button"
              disabled={runnerExecuting}
              onClick={handleTriggerRunner}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
            >
              {runnerExecuting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  EXECUTING RUNNER ENGINE...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  TRIGGER SCHEDULER RUNNER NOW
                </>
              )}
            </button>
          </div>

          {/* Runner Result View */}
          {runnerResult && (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      runnerResult.success
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        : "bg-red-950 text-red-400 border border-red-800"
                    }`}
                  >
                    {runnerResult.success ? "HTTP 200 SUCCESS" : "FAILED"}
                  </span>
                  <span className="text-xs text-neutral-400">
                    Execution Time: <span className="text-white font-mono">{runnerResult.elapsedMs}ms</span>
                  </span>
                </div>

                {runnerResult.response?.summary && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-emerald-950/70 border border-emerald-800/50 text-emerald-300 font-bold">
                      {runnerResult.response.summary.published} Published
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-300 font-medium">
                      {runnerResult.response.summary.pending} Pending Future
                    </span>
                    <span className={`px-2.5 py-1 rounded-md font-bold ${
                      runnerResult.response.summary.errors > 0
                        ? "bg-red-950/70 border border-red-800/50 text-red-300"
                        : "bg-neutral-800 text-neutral-400"
                    }`}>
                      {runnerResult.response.summary.errors} Errors
                    </span>
                  </div>
                )}
              </div>

              {/* Items Evaluated in Last Run */}
              {runnerResult.response?.results && runnerResult.response.results.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Detailed Execution Breakdown:
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {runnerResult.response.results.map((r: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                          r.action === "published"
                            ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-200"
                            : r.action === "error"
                            ? "bg-red-950/30 border-red-800/40 text-red-200"
                            : "bg-neutral-950/60 border-neutral-800 text-neutral-300"
                        }`}
                      >
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            <span className="uppercase text-[10px] px-1.5 py-0.5 rounded font-mono bg-neutral-800 text-neutral-200">
                              {r.category}
                            </span>
                            <span>{r.idea || "Fixture"}</span>
                            <span className="text-neutral-500 font-mono text-[11px]">
                              ({r.isoDate} {r.time})
                            </span>
                          </div>
                          {r.details && (
                            <div className="mt-1 text-[11px] text-neutral-400 font-mono">
                              {typeof r.details === "object" ? JSON.stringify(r.details) : r.details}
                            </div>
                          )}
                        </div>

                        <div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.action === "published"
                                ? "bg-emerald-500 text-white"
                                : r.action === "error"
                                ? "bg-red-500 text-white"
                                : "bg-neutral-800 text-neutral-300"
                            }`}
                          >
                            {r.action}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw JSON Debug Accordion */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition"
                >
                  {showRawJson ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showRawJson ? "Hide Raw Response JSON" : "View Full Runner Response JSON"}
                </button>

                {showRawJson && (
                  <pre className="mt-2 p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-64">
                    {JSON.stringify(runnerResult, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Live Scheduled Records Queue */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 backdrop-blur-md shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-sky-400" />
                <h2 className="text-lg font-bold text-white">
                  Active Scheduled Records in Airtable
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-950 border border-sky-800 text-sky-300">
                  {scheduledCount} items
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                These are records with `Status = &apos;Scheduled&apos;` in Airtable that the runner will evaluate upon execution.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-neutral-400 text-sm gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-neutral-500" />
              Scanning 79 Airtable tables for scheduled records...
            </div>
          ) : scheduledItems.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 text-sm">
              No records are currently tagged as &apos;Scheduled&apos; in Airtable.
              <div className="mt-2 text-xs text-neutral-600">
                Go to the Content Calendar, choose an item, and click &apos;Tag as Scheduled&apos; to test.
              </div>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 font-semibold uppercase text-[11px] tracking-wider">
                    <th className="pb-3 pl-2">Item / Content</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Scheduled (PHT)</th>
                    <th className="pb-3">Timing Status</th>
                    <th className="pb-3">Media</th>
                    <th className="pb-3 text-right pr-2">Quick Test Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {scheduledItems.map((item) => (
                    <tr key={item.recordId} className="hover:bg-neutral-800/30 transition">
                      
                      {/* Item details */}
                      <td className="py-4 pl-2">
                        <div className="font-bold text-white text-sm">
                          {item.idea || item.fixture || "Fixture Item"}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono mt-0.5 flex items-center gap-2">
                          <span>Rec: {item.recordId}</span>
                          <span>•</span>
                          <span>Tbl: {item.tableId}</span>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.category === "Reels"
                              ? "bg-purple-950 text-purple-300 border border-purple-800"
                              : item.category === "Stories"
                              ? "bg-pink-950 text-pink-300 border border-pink-800"
                              : "bg-blue-950 text-blue-300 border border-blue-800"
                          }`}
                        >
                          {item.category}
                        </span>
                      </td>

                      {/* Scheduled Time */}
                      <td className="py-4 font-mono font-medium text-neutral-200">
                        {item.phtScheduledString}
                      </td>

                      {/* Overdue / Due Countdown Badge */}
                      <td className="py-4">
                        {item.isOverdue ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-950/80 border border-red-700/60 px-2.5 py-1 text-[11px] font-bold text-red-300 animate-pulse">
                            <AlertTriangle className="h-3 w-3 text-red-400" />
                            OVERDUE ({Math.abs(item.diffMinutes)}m ago)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2.5 py-1 text-[11px] font-semibold text-neutral-300">
                            <Clock className="h-3 w-3 text-neutral-400" />
                            Due in {item.diffMinutes} mins
                          </span>
                        )}
                      </td>

                      {/* Media Check */}
                      <td className="py-4">
                        {item.hasMedia ? (
                          <div className="flex items-center gap-2">
                            {item.mediaUrl && (
                              <a
                                href={item.mediaUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group relative block h-9 w-9 rounded-md overflow-hidden bg-neutral-800 border border-neutral-700"
                              >
                                {item.mediaType === "video" ? (
                                  <div className="h-full w-full flex items-center justify-center bg-neutral-900 text-[9px] font-bold text-purple-400">
                                    VIDEO
                                  </div>
                                ) : (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={item.mediaUrl}
                                    alt="thumb"
                                    className="h-full w-full object-cover group-hover:scale-110 transition"
                                  />
                                )}
                              </a>
                            )}
                            <span className="text-[11px] text-emerald-400 font-medium">
                              Ready {item.slides && item.slides.length > 1 ? `(${item.slides.length} slides)` : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-400 font-medium">
                            No media URL
                          </span>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="py-4 text-right pr-2 space-x-2">
                        {/* Quick Reschedule to Now + 2m */}
                        <button
                          type="button"
                          disabled={actionLoadingId === `${item.recordId}-reschedule`}
                          onClick={() => handleQuickReschedule(item.tableId, item.recordId, 2)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-950/80 border border-sky-800 text-sky-300 hover:bg-sky-900 hover:text-white text-xs font-semibold transition disabled:opacity-50"
                          title="Schedule for 2 minutes from now to test runner firing"
                        >
                          <Sparkles className="h-3 w-3 text-sky-400" />
                          Set: Now + 2m
                        </button>

                        {/* Reset status to Completed */}
                        <button
                          type="button"
                          disabled={actionLoadingId === `${item.recordId}-status`}
                          onClick={() => handleSetStatus(item.tableId, item.recordId, "Completed")}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition disabled:opacity-50"
                          title="Untag from Scheduled"
                        >
                          Untag
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
