import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  autoEnv,
  getAllConfiguredTables,
} from "@/lib/tables-config"
import { extractOutputMedia, deriveForeignKeyId } from "@/lib/output-media"
import { AirtableReadError, readAirtableRecords } from "@/server/airtable/records"
import { ScheduleValidationError, syncAirtableRecord } from "@/server/airtable/write-schedule"

const MARKETING_AUTOMATION_DIR =
  process.env.MARKETING_AUTOMATION_DIR || "C:\\Users\\User\\marketing-automation"

export type OutputItem = {
  recordId: string
  tableId?: string
  category: string
  contentType: string
  foreignKeyId: string
  status: "Completed" | "Scheduled" | "Posted" | "For Manual" | "Discard"
  rawStatus: string
  date: string
  time: string
  generatedDate?: string
  generatedTime?: string
  scheduledDate?: string
  scheduledTime?: string
  mediaType: "image" | "video"
  slides: string[]
  videoUrl?: string
  duration?: string
  caption: string
  airtableUrl: string
  itemNames: string[]
  fixtureType?: string
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export type TableTarget = {
  tableId: string
  fixtureType?: string
}


function normalizeStatus(
  raw?: string | null
): "Completed" | "Scheduled" | "Posted" | "For Manual" | "Discard" {
  if (!raw) return "Completed"
  const s = raw.trim().toLowerCase()
  if (s.includes("post")) return "Posted"
  if (s.includes("sched")) return "Scheduled"
  if (s.includes("complete") || s.includes("done")) return "Completed"
  if (s.includes("manual") || s.includes("revision") || s === "fm") return "For Manual"
  if (s.includes("discard")) return "Discard"
  return "Completed"
}

function extractCaption(fields: Record<string, any>): string {
  for (const [key, val] of Object.entries(fields)) {
    const lower = key.trim().toLowerCase()
    if (
      lower === "generated caption" ||
      lower === "caption generated" ||
      lower === "caption" ||
      lower === "post caption" ||
      lower === "final caption" ||
      lower === "copy"
    ) {
      if (typeof val === "string" && val.trim()) {
        return val.trim()
      }
    }
  }
  return ""
}

function formatDateDisplay(isoDateString?: string): { date: string; time: string } {
  if (!isoDateString || !String(isoDateString).trim()) {
    return { date: "", time: "" }
  }

  try {
    const d = new Date(isoDateString)
    if (isNaN(d.getTime())) {
      return { date: "", time: "" }
    }

    // Format strictly in Asia/Manila (PHT, UTC+8)
    const monthFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "long" })
    const dayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", day: "numeric" })
    const yearFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric" })
    const weekdayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "long" })

    const monthName = monthFormatter.format(d)
    const dayNum = dayFormatter.format(d)
    const yearNum = yearFormatter.format(d)
    const dayName = weekdayFormatter.format(d)

    // 24-hour time strictly in Asia/Manila
    const timeFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    const time = timeFormatter.format(d)

    return {
      date: `${monthName} ${dayNum}, ${yearNum} (${dayName})`,
      time,
    }
  } catch {
    return { date: "", time: "" }
  }
}


// Map pipeline keys to table IDs retrieved from .env
function getTableIdsForPipeline(category: string, type: string, autoEnv: Record<string, string>): string[] {
  const cat = category.toLowerCase()
  const t = type.toLowerCase()
  const ids: (string | undefined)[] = []

  if (cat === "feeds") {
    if (t.includes("tips")) {
      ids.push("tblIhCP3Gjg09QFCK", "tblQ65S51Dmauwx4c", "tblQuhvktqYB59Ofw", "tblwY6eGQCD5bJeF1")
    } else if (t.includes("moodboard #2") || t.includes("moodboard 2")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_2_FEED || "tbltWgQKOYjuHw6tx",
        autoEnv.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_2_FEED || "tbl4TiV90SzdBz4KG",
        autoEnv.AIRTABLE_TABLE_ID_FLOOR_LAMPS_MOODBOARD_2_FEED || "tbl4YF9iXlBqGblEc",
        autoEnv.AIRTABLE_TABLE_ID_WALL_LIGHTS_MOODBOARD_2_FEED || "tbljUk9JwzS1JeZJg"
      )
    } else if (t.includes("day & night") || t.includes("day and night") || t.includes("d&n") || t.includes("day (") || t.includes("night (")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_CHANDELIER_DAY_AND_NIGHT_4_5,
        autoEnv.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_DAY_NIGHT_FEED,
        autoEnv.AIRTABLE_TABLE_ID_FLOOR_LAMPS_DAY_NIGHT_FEED,
        autoEnv.AIRTABLE_TABLE_ID_TABLE_LAMPS_DAY_NIGHT_FEED
      )
    } else if (t.includes("showcase")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_PRODUCT_SHOWCASE_TABLE_LAMP || "tbln0MNBaVVrZ0wrF",
        autoEnv.AIRTABLE_TABLE_ID_PRODUCT_SHOWCASE_CHANDELIER,
        autoEnv.AIRTABLE_TABLE_ID_PRODUCT_SHOWCASE_PENDANT_LIGHTS
      )
    } else if (t.includes("moodboard #1") || t.includes("moodboard 1") || t.includes("moodboard")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_1_FEED || "tbl9u5vjgx8kuE44R",
        autoEnv.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_1_FEED || "tblOvvYdgsNTXh2zK",
        autoEnv.AIRTABLE_TABLE_ID_FLOOR_LAMPS_MOODBOARD_1_FEED || "tbl6uTmwM23KK9ocO",
        autoEnv.AIRTABLE_TABLE_ID_TABLE_LAMPS_MOODBOARD_1_FEED || "tbljsKOEhc0618qbM"
      )
    } else if (t.includes("collection category")) {
      ids.push(autoEnv.AIRTABLE_TABLE_ID_COLLECTION_CATEGORY_FEED)
    } else if (t.includes("1 product 3 styles") || t.includes("1 product three styles")) {
      ids.push(autoEnv.AIRTABLE_TABLE_ID_1_PRODUCT_3_STYLES_FEED)
    }
  } else if (cat === "stories") {
    if (t.includes("cta")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_CHANDELIER_CTA || "tblYHdVq14FjMWg5o",
        autoEnv.AIRTABLE_TABLE_ID_CLUSTER_CHANDELIER_CTA || "tblSpGJLO3faYfIDY",
        autoEnv.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_CTA || "tblfl7fqFZa2vUieB",
        autoEnv.AIRTABLE_TABLE_ID_TABLE_LAMPS_CTA || "tblKJeCCp4zQ6g7Em",
        autoEnv.AIRTABLE_TABLE_ID_FLOOR_LAMP_CTA || "tblPKSYyjgbgMypE2"
      )
    } else if (t.includes("tips")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_TIPS_EDU_STORY,
        autoEnv.AIRTABLE_TABLE_ID_FLOOR_LAMPS_TIPS_EDU_STORY,
        autoEnv.AIRTABLE_TABLE_ID_CHANDELIERS_TIPS_EDU_STORY,
        autoEnv.AIRTABLE_TABLE_ID_CEILING_MOUNTED_TIPS_EDU_STORY,
        autoEnv.AIRTABLE_TABLE_ID_TABLE_LAMPS_TIPS_EDU_STORY,
        autoEnv.AIRTABLE_TABLE_ID_CLUSTER_CHANDELIERS_TIPS_EDU_STORY
      )
    } else if (t.includes("myth")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_MYTH_AND_FACT_CHANDELIER,
        autoEnv.AIRTABLE_TABLE_ID_MYTH_AND_FACT_FLOOR_LAMPS,
        autoEnv.AIRTABLE_TABLE_ID_MYTH_AND_FACT_PENDANT_LIGHTS
      )
    } else if (t.includes("style this")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_STYLE_THIS_CHANDELIER,
        autoEnv.AIRTABLE_TABLE_ID_STYLE_THIS_FLOOR_LAMPS
      )
    } else if (t.includes("day & night") || t.includes("day and night") || t.includes("d&n") || t.includes("day (") || t.includes("night (")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_CHANDELIER_DAY_NIGHT_STORY,
        autoEnv.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_DAY_NIGHT_STORY,
        autoEnv.AIRTABLE_TABLE_ID_FLOOR_LAMPS_DAY_NIGHT_STORY,
        autoEnv.AIRTABLE_TABLE_ID_TABLE_LAMPS_DAY_NIGHT_STORY,
        autoEnv.AIRTABLE_TABLE_ID_CLUSTER_CHANDELIER_DAY_NIGHT_STORY
      )
    } else if (t.includes("moodboard")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_STORY,
        autoEnv.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_STORY
      )
    } else if (t.includes("specification") || t.includes("specs")) {
      ids.push("tblEGTB6BodRVDqBV")
    } else if (t.includes("description") || t.includes("closeup")) {
      ids.push("tblDcT6jovdAbKnfw", "tblDD2w4v0Idb4jAZ", "tblPvHyKGByWJCMtY", "tblnIOQVywHcTgAtv", "tbl5S9JEHSrjrLwxA", "tblYqudlgjYMNRROM")
    } else if (t.includes("this or that")) {
      ids.push("tblo42IkuhYLIQBzk", "tblS1VHp41RDfxztD", "tblaoqj8VPVHFmVQn", "tblYAhjKckXtjUayx", "tblm1Ty2QkAlUcHJt", "tblZw6jvSa27oZDiN")
    }
  } else if (cat === "reels") {
    if (t.includes("day & night") || t.includes("day and night") || t.includes("d&n") || t.includes("day (") || t.includes("night (")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_CHANDELIER_DAY_AND_NIGHT_REEL,
        autoEnv.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_DAY_AND_NIGHT_REEL,
        autoEnv.AIRTABLE_TABLE_ID_FLOORLAMP_DAY_AND_NIGHT_REEL
      )
    } else if (t.includes("before") && t.includes("after")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_BEFORE_AFTER_CHANDELIER || "tbloMhCOngGDWFS2y",
        autoEnv.AIRTABLE_TABLE_ID_BEFORE_AFTER_PENDANT_LIGHTS || "tbleUP86Kw36G8Hdw"
      )
    } else if (t.includes("moodboard")) {
      ids.push(autoEnv.AIRTABLE_TABLE_ID_CHANDELIER_MODERN_MOODBOARDREEL)
    } else if (t.includes("style") || t.includes("3 styles")) {
      ids.push(autoEnv.AIRTABLE_TABLE_ID_STYLE_REEL_SLIDESHOW)
    } else if (t.includes("closeup")) {
      ids.push("tblqBZ946hVdOpmDV")
    }
  }

  // Filter out undefined and empty string IDs
  return ids.filter((x): x is string => Boolean(x && x.startsWith("tbl")))
}

function normalizeIdeaForMatching(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function matchIdeaTarget(requestIdea: string, targetIdea: string): boolean {
  const req = normalizeIdeaForMatching(requestIdea)
  const tgt = normalizeIdeaForMatching(targetIdea)
  if (req === tgt) return true

  // Specific numeric / subtype exclusions
  if (req.includes("1") && tgt.includes("2")) return false
  if (req.includes("2") && tgt.includes("1")) return false
  if (req.includes("desc") && tgt.includes("spec")) return false
  if (req.includes("spec") && tgt.includes("desc")) return false
  if (tgt.includes("slideshow") && !req.includes("slideshow")) return false

  // Canonical semantic matching
  if (req.includes("cta") && tgt.includes("cta")) return true
  if (req.includes("moodboard") && req.includes("story") && tgt.includes("moodboard") && tgt.includes("story")) return true
  if (req.includes("myth") && tgt.includes("myth")) return true
  if (req.includes("style") && tgt.includes("style")) return true
  if (req.includes("that") && tgt.includes("that")) return true
  if (req.includes("close") && tgt.includes("close")) return true
  if (req.includes("tips") && tgt.includes("tips")) return true
  if (req.includes("before") && tgt.includes("before")) return true
  if (req.includes("day") && tgt.includes("day")) return true
  if (req.includes("1prod") && tgt.includes("1prod")) return true
  if (req.includes("showcase") && tgt.includes("showcase")) return true
  if (req.includes("collection") && tgt.includes("collection")) return true

  return req.includes(tgt) || tgt.includes(req)
}

function getTableTargetsForPipeline(category: string, type: string, autoEnv: Record<string, string>): TableTarget[] {
  const all = getAllConfiguredTables()
  const matched = all.filter((t) => {
    if (t.category.toLowerCase() !== category.toLowerCase()) return false
    return matchIdeaTarget(type, t.idea)
  })

  if (matched.length > 0) {
    return matched.map((t) => ({ tableId: t.tableId, fixtureType: t.fixtureType }))
  }

  // Fallback to getTableIdsForPipeline if anything missed
  const ids = getTableIdsForPipeline(category, type, autoEnv)
  const idToFixture = new Map(all.map((t) => [t.tableId, t.fixtureType]))
  return ids.map((tableId) => ({ tableId, fixtureType: idToFixture.get(tableId) }))
}


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedCategory = (searchParams.get("category") || "Feeds").trim().toLowerCase()
    const category = ({ feeds: "Feeds", stories: "Stories", reels: "Reels" } as const)[requestedCategory as "feeds" | "stories" | "reels"]
    if (!category) {
      return NextResponse.json({ status: "error", error: "Unsupported content category" }, { status: 400 })
    }
    const contentType = (searchParams.get("type") || "Tips & Educational").trim()

    const isReels = category === "Reels"
    const isMoodboardStory = category === "Stories" && contentType.toLowerCase().includes("moodboard")
    const isThisOrThatStory = category === "Stories" && contentType.toLowerCase().includes("this or that")

    const aspectRatio = category.toLowerCase() === "feeds" ? "4:5" : "9:16"
    const mediaType = isReels ? "video" : "image"

    const tableTargets = [...new Map(getTableTargetsForPipeline(category, contentType, autoEnv)
      .map(target => [target.tableId, target])).values()]
    const allItems: OutputItem[] = []
    const failures: { tableId: string; code: string; httpStatus?: number }[] = []
    let successfulTables = 0

    if (tableTargets.length === 0) {
      return NextResponse.json({ status: "error", error: "No table mapping exists for this content type" }, { status: 422 })
    }

    for (const target of tableTargets) {
      const { tableId, fixtureType } = target
      try {
        const records = await readAirtableRecords({
          baseId: AIRTABLE_BASE_ID, tableId, token: AIRTABLE_TOKEN, signal: request.signal,
        })

        for (let recIndex = 0; recIndex < records.length; recIndex++) {
          const rec = records[recIndex]
          const fields = rec.fields || {}

          const media = extractOutputMedia(fields, category, contentType)
          if (!media.mediaUrl) continue
          const slides = media.mediaType === "image" ? media.slides : []
          const videoUrl = media.mediaType === "video" ? media.mediaUrl : undefined

          const rawStatus = fields["Status"] || "Completed"
          const status = normalizeStatus(rawStatus)

          // Extract Date and Time Generated (when the asset was created by automation)
          const genDateField =
            fields["Date and Time Generated"] ||
            fields["Date and Time Run (PHT)"] ||
            fields["Date & Time Run (PHT)"]
          const { date: generatedDate, time: generatedTime } = genDateField
            ? formatDateDisplay(genDateField)
            : { date: "", time: "" }

          // Extract Date and Time Scheduled (when the post is scheduled for)
          const schedDateField =
            fields["Date and Time Scheduled"] ||
            fields["Date and Time"] ||
            fields["Date & Time"] ||
            fields["Date"]
          const { date: scheduledDate, time: scheduledTime } = schedDateField
            ? formatDateDisplay(schedDateField)
            : { date: "", time: "" }

          const date = generatedDate || ""
          const time = generatedTime || ""

          const fkId = deriveForeignKeyId(fields, category, contentType, fixtureType, rec.id, recIndex + 1)

          const itemNames: string[] = []
          for (let i = 1; i <= 4; i++) {
            const key = i === 1 ? "Item Name" : `Item Name${i}`
            if (fields[key]) itemNames.push(String(fields[key]))
          }

          const caption = extractCaption(fields)

          const fixture =
            fixtureType ||
            fields["Fixture"] ||
            fields["Category"] ||
            fields["Fixture Type"] ||
            undefined

          allItems.push({
            recordId: rec.id,
            tableId,
            category,
            contentType,
            foreignKeyId: fkId,
            status,
            rawStatus: String(rawStatus),
            date,
            time,
            generatedDate,
            generatedTime,
            scheduledDate,
            scheduledTime,
            mediaType: isReels ? "video" : (videoUrl ? "video" : "image"),
            slides: isReels ? [] : slides,
            videoUrl: isReels ? videoUrl : (videoUrl || undefined),
            duration: isReels ? "15s" : undefined,
            caption,
            airtableUrl: `https://airtable.com/${AIRTABLE_BASE_ID}/${tableId}/${rec.id}`,
            itemNames,
            fixtureType: fixture,
          })
        }
        successfulTables++
      } catch (err) {
        failures.push({
          tableId,
          code: err instanceof AirtableReadError ? err.code : "READ_FAILED",
          httpStatus: err instanceof AirtableReadError ? err.httpStatus : undefined,
        })
      }
    }

    const diagnostics = {
      partial: failures.length > 0 && successfulTables > 0,
      successfulTables,
      failedTables: failures.length,
      failures,
    }
    if (successfulTables === 0) {
      return NextResponse.json({ status: "error", error: "Unable to read output tables. Check Airtable configuration and retry.", diagnostics, items: [] }, { status: 502 })
    }

    // Also fallback to local MP4s in output/videos/ if category is Reels
    if (process.env.NODE_ENV === "development" && isReels && allItems.length === 0) {
      const videosDir = path.join(MARKETING_AUTOMATION_DIR, "output", "videos")
      if (fs.existsSync(videosDir)) {
        try {
          const videoFiles = fs.readdirSync(videosDir).filter((f: string) => f.endsWith(".mp4"))
          for (const vf of videoFiles) {
            let fileDate = ""
            let fileTime = ""
            try {
              const st = fs.statSync(path.join(videosDir, vf))
              const fd = formatDateDisplay(st.mtime.toISOString())
              fileDate = fd.date
              fileTime = fd.time
            } catch {}

            allItems.push({
              recordId: vf.replace(/\.mp4$/, ""),
              category,
              contentType,
              foreignKeyId: `REEL-${vf.slice(0, 16)}`,
              status: "Completed",
              rawStatus: "Completed",
              date: fileDate,
              time: fileTime,
              generatedDate: fileDate,
              generatedTime: fileTime,
              mediaType: "video",
              slides: [],
              videoUrl: `/api/media/videos/${vf}`,
              duration: "12s",
              caption: "",
              airtableUrl: `https://airtable.com/${AIRTABLE_BASE_ID}`,
              itemNames: [],
            })
          }
        } catch (e) {}
      }
    }

    return NextResponse.json({
      status: "success",
      category,
      type: contentType,
      aspectRatio,
      mediaType,
      total: allItems.length,
      items: allItems,
      diagnostics,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", error: error?.message || "Failed to fetch content outputs" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { recordId, tableId, status, date, scheduledIso, time } = await request.json()
    await syncAirtableRecord(tableId, recordId, status, scheduledIso || date, time)
    return NextResponse.json({ status: "success", recordId, tableId })
  } catch (error) {
    const invalid = error instanceof ScheduleValidationError || error instanceof SyntaxError
    return NextResponse.json(
      { status: "error", error: invalid ? (error instanceof SyntaxError ? "Invalid JSON body" : error.message) : "Airtable could not save the complete change. Verify the date/status fields and retry." },
      { status: invalid ? 400 : 502 },
    )
  }
}
