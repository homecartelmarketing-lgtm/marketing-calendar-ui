import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const MARKETING_AUTOMATION_DIR =
  process.env.MARKETING_AUTOMATION_DIR || "C:\\Users\\User\\marketing-automation"

function loadAutomationEnv(): Record<string, string> {
  const envPath = path.join(MARKETING_AUTOMATION_DIR, ".env")
  const out: Record<string, string> = {}
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8")
      for (const line of content.split("\n")) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue
        const idx = trimmed.indexOf("=")
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim()
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "")
          out[key] = val
        }
      }
    } catch (e) {
      console.error("Error reading automation .env:", e)
    }
  }
  return out
}

const autoEnv = loadAutomationEnv()
const AIRTABLE_TOKEN =
  process.env.AIRTABLE_TOKEN ||
  autoEnv.AIRTABLE_TOKEN ||
  "pat6TrWWL12GbH46s.32f28bcfd2bd7081ccccfc0955118a7329dde2a75b3aed70c2ab0d8c3c918484"
const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID || autoEnv.AIRTABLE_BASE_ID || "appDM0jUDsaiThtR3"

export type ScheduledEntry = {
  recordId?: string
  tableId?: string
  isoDate: string
  rowKey: string
  category: "Feeds" | "Reels" | "Stories"
  idea: string
  time: string | null
  fixture?: string
  foreignKeyId: string
  status: "Scheduled" | "Posted" | "Completed" | "Discard" | "For Manual"
  caption?: string
  airtableUrl?: string
  itemNames?: string[]
  updatedAt: string
}

const DEFAULT_SCHEDULES_FILE = path.join(process.cwd(), "data", "schedules.json")

function getSchedulesFilePath(): string {
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "schedules.json")
  }
  return DEFAULT_SCHEDULES_FILE
}

let memorySchedulesCache: Record<string, ScheduledEntry[]> | null = null

function readSchedules(): Record<string, ScheduledEntry[]> {
  if (memorySchedulesCache) {
    return memorySchedulesCache
  }
  const filePath = getSchedulesFilePath()
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8")
      memorySchedulesCache = JSON.parse(data)
      return memorySchedulesCache || {}
    }
    // Fallback: Check if bundled data/schedules.json exists
    if (fs.existsSync(DEFAULT_SCHEDULES_FILE)) {
      const data = fs.readFileSync(DEFAULT_SCHEDULES_FILE, "utf-8")
      memorySchedulesCache = JSON.parse(data)
      return memorySchedulesCache || {}
    }
    return {}
  } catch (error) {
    console.error("Failed to read schedules:", error)
    return {}
  }
}

function writeSchedules(schedules: Record<string, ScheduledEntry[]>) {
  memorySchedulesCache = schedules
  const filePath = getSchedulesFilePath()
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(schedules, null, 2), "utf-8")
  } catch (error) {
    console.warn("Could not persist schedules to disk (likely read-only cloud environment):", error)
  }
}

// Build map of locked foreign keys across all dates:
// foreignKeyId -> { isoDate, category, idea, fixture, status }
function getLockedForeignKeys(schedules: Record<string, ScheduledEntry[]>) {
  const locked: Record<
    string,
    { isoDate: string; category: string; idea: string; fixture?: string; status: string }
  > = {}

  for (const [isoDate, entries] of Object.entries(schedules)) {
    for (const entry of entries) {
      if (entry.foreignKeyId && (entry.status === "Scheduled" || entry.status === "Posted")) {
        locked[entry.foreignKeyId] = {
          isoDate,
          category: entry.category,
          idea: entry.idea,
          fixture: entry.fixture,
          status: entry.status,
        }
      }
    }
  }
  return locked
}

async function syncAirtableRecord(
  tableId?: string,
  recordId?: string,
  status?: string,
  isoDate?: string,
  time?: string | null
) {
  if (!tableId || !recordId || !tableId.startsWith("tbl")) return
  try {
    const fieldsToUpdate: Record<string, any> = {}
    if (status) fieldsToUpdate["Status"] = status
    if (isoDate) {
      const dateTimeStr = time ? `${isoDate}T${time}:00.000Z` : `${isoDate}T00:00:00.000Z`
      fieldsToUpdate["Date and Time"] = dateTimeStr
    }

    const patchRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: fieldsToUpdate }),
      }
    )

    if (!patchRes.ok) {
      // Fallback: Status only
      await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fields: { Status: status || "Scheduled" } }),
        }
      )
    }
  } catch (err) {
    console.error("Airtable sync error in schedules API:", err)
  }
}

export async function GET() {
  const schedules = readSchedules()
  const lockedForeignKeys = getLockedForeignKeys(schedules)

  return NextResponse.json({
    success: true,
    schedules,
    lockedForeignKeys,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScheduledEntry
    const { isoDate, rowKey, foreignKeyId, category, idea, tableId, recordId, status, time } = body

    if (!isoDate || !rowKey || !category || !idea) {
      return NextResponse.json(
        { success: false, message: "isoDate, rowKey, category, and idea are required" },
        { status: 400 }
      )
    }

    const finalStatus = status || "Scheduled"

    // 1. Sync to Airtable (Single Source of Truth)
    if (tableId && recordId) {
      await syncAirtableRecord(tableId, recordId, finalStatus, isoDate, time)
    }

    // 2. Persist to fast local cache
    const schedules = readSchedules()
    const dateEntries = schedules[isoDate] || []

    const newEntry: ScheduledEntry = {
      ...body,
      status: finalStatus,
      updatedAt: new Date().toISOString(),
    }

    // Replace if rowKey exists, or append
    const existingIndex = dateEntries.findIndex(
      (e) => e.rowKey === rowKey || (e.category === category && e.idea === idea)
    )
    if (existingIndex >= 0) {
      dateEntries[existingIndex] = newEntry
    } else {
      dateEntries.push(newEntry)
    }

    schedules[isoDate] = dateEntries
    writeSchedules(schedules)

    const lockedForeignKeys = getLockedForeignKeys(schedules)

    return NextResponse.json({
      success: true,
      entry: newEntry,
      schedules,
      lockedForeignKeys,
    })
  } catch (error: any) {
    console.error("Error saving schedule:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save schedule" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isoDate = searchParams.get("isoDate")
    const rowKey = searchParams.get("rowKey")
    const tableId = searchParams.get("tableId")
    const recordId = searchParams.get("recordId")

    if (!isoDate) {
      return NextResponse.json(
        { success: false, message: "isoDate is required" },
        { status: 400 }
      )
    }

    // Reset Airtable status if provided
    if (tableId && recordId) {
      await syncAirtableRecord(tableId, recordId, "Completed", undefined, undefined)
    }

    const schedules = readSchedules()
    if (schedules[isoDate]) {
      if (rowKey) {
        schedules[isoDate] = schedules[isoDate].filter((e) => e.rowKey !== rowKey)
      } else {
        delete schedules[isoDate]
      }
      writeSchedules(schedules)
    }

    const lockedForeignKeys = getLockedForeignKeys(schedules)

    return NextResponse.json({
      success: true,
      schedules,
      lockedForeignKeys,
    })
  } catch (error: any) {
    console.error("Error deleting schedule:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to delete schedule" },
      { status: 500 }
    )
  }
}
