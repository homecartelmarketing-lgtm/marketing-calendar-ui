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
      fieldsToUpdate["Date and Time Scheduled"] = dateTimeStr
      fieldsToUpdate["Date and Time"] = dateTimeStr
    } else if (status === "Completed") {
      // Clear scheduled dates when unscheduled
      fieldsToUpdate["Date and Time Scheduled"] = null
      fieldsToUpdate["Date and Time"] = null
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
      // Fallback: Try with Date and Time Scheduled only, then Status only
      const fallbackFields: Record<string, any> = { Status: status || "Scheduled" }
      if (isoDate) {
        fallbackFields["Date and Time Scheduled"] = time ? `${isoDate}T${time}:00.000Z` : `${isoDate}T00:00:00.000Z`
      } else if (status === "Completed") {
        fallbackFields["Date and Time Scheduled"] = null
      }

      const retryRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fields: fallbackFields }),
        }
      )

      if (!retryRes.ok) {
        // Ultimate fallback: Status only
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
    }
  } catch (err) {
    console.error("Airtable sync error in schedules API:", err)
  }
}

async function pullAirtableSchedules(): Promise<Record<string, ScheduledEntry[]>> {
  const tablesToScan = [
    { tableId: process.env.AIRTABLE_TABLE_ID_CHANDELIER_CTA || "tblYHdVq14FjMWg5o", category: "Stories" as const, idea: "CTA Story", fixture: "Chandelier" },
    { tableId: process.env.AIRTABLE_TABLE_ID_CLUSTER_CHANDELIER_CTA || "tblSpGJLO3faYfIDY", category: "Stories" as const, idea: "CTA Story", fixture: "Cluster Chandelier" },
    { tableId: process.env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_CTA || "tblfl7fqFZa2vUieB", category: "Stories" as const, idea: "CTA Story", fixture: "Pendant Light" },
    { tableId: process.env.AIRTABLE_TABLE_ID_TABLE_LAMPS_CTA || "tblKJeCCp4zQ6g7Em", category: "Stories" as const, idea: "CTA Story", fixture: "Table Lamp" },
    { tableId: process.env.AIRTABLE_TABLE_ID_FLOOR_LAMP_CTA || "tblPKSYyjgbgMypE2", category: "Stories" as const, idea: "CTA Story", fixture: "Floor Lamp" },
    { tableId: process.env.AIRTABLE_TABLE_ID_CHANDELIER_DAY_NIGHT_STORY || "tblKkCf88UVQ3Yu07", category: "Stories" as const, idea: "Day & Night", fixture: "Chandelier" },
    { tableId: process.env.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_2_FEED || "tbltWgQKOYjuHw6tx", category: "Feeds" as const, idea: "Moodboard #2", fixture: "Chandelier" },
  ]

  const out: Record<string, ScheduledEntry[]> = {}

  await Promise.all(
    tablesToScan.map(async (cfg) => {
      try {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${cfg.tableId}?filterByFormula=${encodeURIComponent("Status='Scheduled'")}`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
          next: { revalidate: 5 },
        })
        if (!res.ok) return
        const data = await res.json()
        for (const r of data.records || []) {
          const fields = r.fields || {}
          const dateVal = fields["Date and Time Scheduled"] || fields["Date and Time"] || fields["Date & Time"] || fields["Date"]
          if (!dateVal) continue

          const d = new Date(dateVal)
          if (isNaN(d.getTime())) continue

          const isoDate = dateVal.slice(0, 10)
          const hours = String(d.getHours()).padStart(2, "0")
          const mins = String(d.getMinutes()).padStart(2, "0")
          const time = `${hours}:${mins}`

          const fkId =
            fields["Foreign Key ID"] ||
            fields["CID"] ||
            (fields["ID"] ? `CID-${fields["ID"]}` : r.id)

          const entry: ScheduledEntry = {
            recordId: r.id,
            tableId: cfg.tableId,
            isoDate,
            rowKey: `${cfg.category}-${cfg.idea}-${isoDate}`,
            category: cfg.category,
            idea: cfg.idea,
            time,
            fixture: cfg.fixture,
            foreignKeyId: fkId,
            status: "Scheduled",
            caption: fields["Generated Caption"] || fields["Caption"] || "",
            airtableUrl: `https://airtable.com/${AIRTABLE_BASE_ID}/${cfg.tableId}/${r.id}`,
            updatedAt: new Date().toISOString(),
          }

          if (!out[isoDate]) out[isoDate] = []
          // Avoid duplicate foreign keys on same date
          if (!out[isoDate].some((e) => e.foreignKeyId === fkId)) {
            out[isoDate].push(entry)
          }
        }
      } catch (err) {
        console.warn(`Error pulling schedules from table ${cfg.tableId}:`, err)
      }
    })
  )

  return out
}

export async function GET() {
  const localSchedules = readSchedules()
  const airtableSchedules = await pullAirtableSchedules()

  // Merge: start with local cache, overlay Airtable live schedules
  const mergedSchedules: Record<string, ScheduledEntry[]> = { ...localSchedules }
  for (const [isoDate, entries] of Object.entries(airtableSchedules)) {
    if (!mergedSchedules[isoDate]) {
      mergedSchedules[isoDate] = entries
    } else {
      for (const e of entries) {
        const idx = mergedSchedules[isoDate].findIndex(
          (existing) => existing.foreignKeyId === e.foreignKeyId || existing.rowKey === e.rowKey
        )
        if (idx >= 0) {
          mergedSchedules[isoDate][idx] = e
        } else {
          mergedSchedules[isoDate].push(e)
        }
      }
    }
  }

  const lockedForeignKeys = getLockedForeignKeys(mergedSchedules)

  return NextResponse.json({
    success: true,
    schedules: mergedSchedules,
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
    const foreignKeyId = searchParams.get("foreignKeyId")

    // Reset Airtable status and clear scheduled date if tableId & recordId provided
    if (tableId && recordId) {
      await syncAirtableRecord(tableId, recordId, "Completed", undefined, undefined)
    }

    const schedules = readSchedules()

    if (isoDate && schedules[isoDate]) {
      if (rowKey || recordId || foreignKeyId) {
        schedules[isoDate] = schedules[isoDate].filter(
          (e) =>
            (!rowKey || e.rowKey !== rowKey) &&
            (!recordId || e.recordId !== recordId) &&
            (!foreignKeyId || e.foreignKeyId !== foreignKeyId)
        )
      } else {
        delete schedules[isoDate]
      }
    } else {
      // If no isoDate passed, remove from any date where recordId/rowKey/foreignKey matches
      for (const [date, entries] of Object.entries(schedules)) {
        schedules[date] = entries.filter(
          (e) =>
            (!rowKey || e.rowKey !== rowKey) &&
            (!recordId || e.recordId !== recordId) &&
            (!foreignKeyId || e.foreignKeyId !== foreignKeyId)
        )
      }
    }

    writeSchedules(schedules)
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
