import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  autoEnv,
  getAllConfiguredTables,
} from "@/lib/tables-config"

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

export function getCtaStoryTargets(env: Record<string, string>): TableTarget[] {
  return [
    {
      tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_CTA || "tblYHdVq14FjMWg5o",
      fixtureType: "Chandelier",
    },
    {
      tableId: env.AIRTABLE_TABLE_ID_CLUSTER_CHANDELIER_CTA || "tblSpGJLO3faYfIDY",
      fixtureType: "Cluster Chandelier",
    },
    {
      tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_CTA || "tblfl7fqFZa2vUieB",
      fixtureType: "Pendant Light",
    },
    {
      tableId: env.AIRTABLE_TABLE_ID_TABLE_LAMPS_CTA || "tblKJeCCp4zQ6g7Em",
      fixtureType: "Table Lamp",
    },
    {
      tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMP_CTA || "tblPKSYyjgbgMypE2",
      fixtureType: "Floor Lamp",
    },
  ]
}

export function getMoodboardStoryTargets(env: Record<string, string>): TableTarget[] {
  return [
    {
      tableId: env.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_STORY || "tblHQrci8d1K9ws2M",
      fixtureType: "Chandelier",
    },
    {
      tableId: env.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_STORY || "tblkm119i48y0M1IQ",
      fixtureType: "Pendant Light",
    },
    {
      tableId: env.AIRTABLE_TABLE_ID_FLOOR_LAMPS_MOODBOARD_STORY || "tblBaNeiSZeYrUawW",
      fixtureType: "Floor Lamp",
    },
  ]
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

  const d = new Date(isoDateString)
  if (isNaN(d.getTime())) {
    return { date: "", time: "" }
  }

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const monthName = months[d.getMonth()]
  const dayNum = d.getDate()
  const yearNum = d.getFullYear()
  const dayName = days[d.getDay()]

  const hours = String(d.getHours()).padStart(2, "0")
  const mins = String(d.getMinutes()).padStart(2, "0")

  return {
    date: `${monthName} ${dayNum}, ${yearNum} (${dayName})`,
    time: `${hours}:${mins}`,
  }
}

function extractCtaConvertedImages(fields: Record<string, any>): string[] {
  for (const [key, val] of Object.entries(fields)) {
    if (key.trim().toLowerCase() === "cta converted image") {
      if (Array.isArray(val) && val.length > 0) {
        return val
          .filter((item: any) => item && typeof item === "object" && item.url)
          .map((item: any) => item.url as string)
      }
    }
  }
  return []
}

function extractMoodboardStoryImages(fields: Record<string, any>): string[] {
  const slides: string[] = []

  // Slide 1: Moodboard Converted
  for (const [key, val] of Object.entries(fields)) {
    if (key.trim().toLowerCase() === "moodboard converted") {
      if (Array.isArray(val) && val.length > 0) {
        for (const item of val) {
          if (item && typeof item === "object" && item.url) {
            slides.push(item.url as string)
          }
        }
      }
    }
  }

  // Slide 2: Blended Image
  for (const [key, val] of Object.entries(fields)) {
    if (key.trim().toLowerCase() === "blended image") {
      if (Array.isArray(val) && val.length > 0) {
        for (const item of val) {
          if (item && typeof item === "object" && item.url) {
            slides.push(item.url as string)
          }
        }
      }
    }
  }

  return slides
}

function extractProductCloseupDescriptionConverted(fields: Record<string, any>): string[] {
  for (const [key, val] of Object.entries(fields)) {
    if (key.trim().toLowerCase() === "product closeup description converted") {
      if (Array.isArray(val) && val.length > 0) {
        return val
          .filter((item: any) => item && typeof item === "object" && item.url)
          .map((item: any) => item.url as string)
      }
    }
  }
  return []
}

function extractDayAndNightFeedImages(fields: Record<string, any>): string[] {
  const slides: string[] = []

  // Slide 1: Day Image
  for (const [key, val] of Object.entries(fields)) {
    if (key.trim().toLowerCase() === "day image") {
      if (Array.isArray(val) && val.length > 0) {
        for (const item of val) {
          if (item && typeof item === "object" && item.url) {
            slides.push(item.url as string)
            break
          }
        }
      }
    }
  }

  // Slide 2: Night Image
  for (const [key, val] of Object.entries(fields)) {
    if (key.trim().toLowerCase() === "night image") {
      if (Array.isArray(val) && val.length > 0) {
        for (const item of val) {
          if (item && typeof item === "object" && item.url) {
            slides.push(item.url as string)
            break
          }
        }
      }
    }
  }

  return slides
}

function extractTipsAndEduFeedImages(fields: Record<string, any>): string[] {
  for (const [key, val] of Object.entries(fields)) {
    if (key.trim().toLowerCase() === "tips and edu blended attach item name") {
      if (Array.isArray(val) && val.length > 0) {
        return val
          .filter((item: any) => item && typeof item === "object" && item.url)
          .map((item: any) => item.url as string)
      }
    }
  }
  return []
}

// Map pipeline keys to table IDs retrieved from .env
function getTableIdsForPipeline(category: string, type: string, autoEnv: Record<string, string>): string[] {
  const cat = category.toLowerCase()
  const t = type.toLowerCase()
  const ids: (string | undefined)[] = []

  if (cat === "feeds") {
    if (t.includes("tips")) {
      ids.push("tblIhCP3Gjg09QFCK", "tblQ65S51Dmauwx4c", "tblQuhvktqYB59Ofw", "tblwY6eGQCD5bJeF1")
    } else if (t.includes("moodboard #2") || t.includes("moodboard 2") || t.includes("moodboard")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_2_FEED,
        autoEnv.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_2_FEED,
        autoEnv.AIRTABLE_TABLE_ID_FLOOR_LAMPS_MOODBOARD_2_FEED,
        autoEnv.AIRTABLE_TABLE_ID_WALL_LIGHTS_MOODBOARD_2_FEED
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
    } else if (t.includes("moodboard #2") || t.includes("moodboard 2")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_2_FEED,
        autoEnv.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_2_FEED,
        autoEnv.AIRTABLE_TABLE_ID_FLOOR_LAMPS_MOODBOARD_2_FEED,
        autoEnv.AIRTABLE_TABLE_ID_WALL_LIGHTS_MOODBOARD_2_FEED
      )
    } else if (t.includes("moodboard #1") || t.includes("moodboard 1") || t.includes("moodboard")) {
      ids.push(
        autoEnv.AIRTABLE_TABLE_ID_CHANDELIER_MOODBOARD_1_FEED,
        autoEnv.AIRTABLE_TABLE_ID_PENDANT_LIGHTS_MOODBOARD_1_FEED,
        autoEnv.AIRTABLE_TABLE_ID_FLOOR_LAMPS_MOODBOARD_1_FEED,
        autoEnv.AIRTABLE_TABLE_ID_TABLE_LAMPS_MOODBOARD_1_FEED
      )
    } else if (t.includes("collection category")) {
      ids.push(autoEnv.AIRTABLE_TABLE_ID_COLLECTION_CATEGORY_FEED)
    } else if (t.includes("1 product 3 styles") || t.includes("1 product three styles")) {
      ids.push(autoEnv.AIRTABLE_TABLE_ID_1_PRODUCT_3_STYLES_FEED)
    } else if (t.includes("tips")) {
      ids.push("tblQ65S51Dmauwx4c", "tblIhCP3Gjg09QFCK", "tblQuhvktqYB59Ofw", "tblwY6eGQCD5bJeF1")
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
        autoEnv.AIRTABLE_TABLE_ID_BEFORE_AFTER_CHANDELIER,
        autoEnv.AIRTABLE_TABLE_ID_BEFORE_AFTER_PENDANT_LIGHTS
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
  return ids.map((tableId) => ({ tableId }))
}

// Smart asset extractor across any Airtable table schema
function extractAssetsFromRecord(fields: Record<string, any>, isVideoPreferred: boolean): {
  slides: string[]
  videoUrl?: string
} {
  const IGNORED_INPUTS = new Set([
    "furniture item", "furniture items", "interior", "interiors",
    "logo", "arrow", "arrow2", "fact emoticon", "myth emoticon",
    "music generated", "outro", "overlay logo", "double tap converted"
  ])

  let videoUrl: string | undefined = undefined
  const primarySlides: string[] = []
  const secondarySlides: string[] = []

  for (const [key, val] of Object.entries(fields)) {
    const kLower = key.trim().toLowerCase()
    if (!Array.isArray(val) || val.length === 0 || typeof val[0] !== "object" || !val[0]?.url) {
      continue
    }

    if (IGNORED_INPUTS.has(kLower)) continue

    // 1. Check for Video
    for (const item of val) {
      const isVid =
        item?.type?.startsWith("video/") ||
        item?.filename?.toLowerCase().endsWith(".mp4") ||
        kLower.includes("reel") ||
        kLower.includes("video")

      if (isVid && item?.url) {
        videoUrl = item.url
        if (isVideoPreferred) break
      }
    }

    // 2. Check for Slides (Final outputs get primary priority)
    const isPrimaryOutput =
      kLower.startsWith("story -") ||
      kLower.startsWith("reel -") ||
      kLower.includes("converted") ||
      kLower.includes("tips and edu") ||
      kLower.includes("final stamped output") ||
      kLower.includes("style reel slideshow") ||
      kLower.includes("slide show before") ||
      kLower.includes("day and night reel") ||
      kLower.includes("product showcase") ||
      kLower.includes("showcase feed") ||
      kLower.includes("moodboard") ||
      kLower.includes("1 product") ||
      kLower.includes("collection") ||
      kLower.includes("closeup") ||
      kLower.includes("this or that") ||
      kLower.includes("myth") ||
      kLower.includes("style this")

    const targetList = isPrimaryOutput ? primarySlides : secondarySlides
    for (const item of val) {
      const isImg =
        item?.type?.startsWith("image/") ||
        item?.filename?.match(/\.(jpg|jpeg|png|webp)/i) ||
        !item?.filename?.toLowerCase().endsWith(".mp4")

      if (isImg && item?.url) {
        targetList.push(item.url)
      }
    }
  }

  const slides = primarySlides.length > 0 ? primarySlides : secondarySlides
  return { slides, videoUrl }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = (searchParams.get("category") || "Feeds").trim() as "Feeds" | "Stories" | "Reels"
    const contentType = (searchParams.get("type") || "Tips & Educational").trim()

    const isReels = category.toLowerCase() === "reels"
    const isCtaStory = category.toLowerCase() === "stories" && contentType.toLowerCase().includes("cta")
    const isMoodboardStory = category.toLowerCase() === "stories" && contentType.toLowerCase().includes("moodboard")
    const isProductDescriptionStory =
      category.toLowerCase() === "stories" &&
      (contentType.toLowerCase().includes("description") ||
        (contentType.toLowerCase().includes("closeup") && !contentType.toLowerCase().includes("spec")))
    const isDayAndNightFeed =
      category.toLowerCase() === "feeds" &&
      (contentType.toLowerCase().includes("day & night") ||
        contentType.toLowerCase().includes("day and night") ||
        contentType.toLowerCase().includes("d&n"))
    const isTipsAndEduFeed =
      category.toLowerCase() === "feeds" &&
      contentType.toLowerCase().includes("tips")
    const aspectRatio = category.toLowerCase() === "feeds" ? "4:5" : "9:16"
    const mediaType = isReels ? "video" : "image"

    const tableTargets = getTableTargetsForPipeline(category, contentType, autoEnv)
    const allItems: OutputItem[] = []

    for (const target of tableTargets) {
      const { tableId, fixtureType } = target
      try {
        const res = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}?pageSize=100`,
          {
            headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
            next: { revalidate: 5 },
          }
        )

        if (!res.ok) continue

        const data = await res.json()
        const records = data.records || []

        for (const rec of records) {
          const fields = rec.fields || {}

          let slides: string[] = []
          let videoUrl: string | undefined = undefined

          if (isCtaStory) {
            // Strictly extract ONLY from "CTA Converted Image"
            slides = extractCtaConvertedImages(fields)
            if (slides.length === 0) {
              // Exclude records that have no CTA Converted Image attachment
              continue
            }
          } else if (isMoodboardStory) {
            // Extract Slide 1: Moodboard Converted, Slide 2: Blended Image
            slides = extractMoodboardStoryImages(fields)
            if (slides.length === 0) continue
          } else if (isProductDescriptionStory) {
            // Strictly extract ONLY from "Product Closeup Description Converted" (Zero fallback to Layout drafts)
            slides = extractProductCloseupDescriptionConverted(fields)
            if (slides.length === 0) continue
          } else if (isDayAndNightFeed) {
            // Strictly extract Slide 1: Day Image, Slide 2: Night Image (Ignore Story and Interior inputs)
            slides = extractDayAndNightFeedImages(fields)
            if (slides.length === 0) continue
          } else if (isTipsAndEduFeed) {
            slides = extractTipsAndEduFeedImages(fields)
            if (slides.length === 0) continue
          } else {
            const assets = extractAssetsFromRecord(fields, isReels)
            slides = assets.slides
            videoUrl = assets.videoUrl
            if (slides.length === 0 && !videoUrl) continue
          }

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

          const date = generatedDate || scheduledDate
          const time = generatedTime || scheduledTime

          const fkId =
            fields["Foreign Key ID"] ||
            fields["CID"] ||
            (fields["ID"]
              ? `${isMoodboardStory ? "MB-STORY" : "CTA-STORY"}-${fixtureType ? fixtureType.slice(0, 2).toUpperCase() : "ST"}-${fields["ID"]}`
              : rec.id)

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
            mediaType: isReels && videoUrl ? "video" : "image",
            slides,
            videoUrl,
            duration: isReels ? "15s" : undefined,
            caption,
            airtableUrl: `https://airtable.com/${AIRTABLE_BASE_ID}/${tableId}/${rec.id}`,
            itemNames,
            fixtureType: fixture,
          })
        }
      } catch (err) {
        console.error(`Error querying table ${tableId}:`, err)
      }
    }

    // Also fallback to local MP4s in output/videos/ if category is Reels
    if (isReels && allItems.length === 0) {
      const videosDir = path.join(MARKETING_AUTOMATION_DIR, "output", "videos")
      if (fs.existsSync(videosDir)) {
        try {
          const videoFiles = fs.readdirSync(videosDir).filter((f: string) => f.endsWith(".mp4"))
          for (const vf of videoFiles) {
            allItems.push({
              recordId: vf.replace(/\.mp4$/, ""),
              category,
              contentType,
              foreignKeyId: `REEL-${vf.slice(0, 16)}`,
              status: "Completed",
              rawStatus: "Completed",
              date: "August 31, 2026 (Monday)",
              time: "13:00",
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
    const body = await request.json()
    const { recordId, tableId, status, date, time } = body

    if (!recordId) {
      return NextResponse.json({ status: "error", message: "recordId is required" }, { status: 400 })
    }

    const fieldsToUpdate: Record<string, any> = {}
    if (status) {
      fieldsToUpdate["Status"] = status === "Completed" ? "Complete" : status
    }

    if (date) {
      const timePart = (time || "00:00").padStart(5, "0")
      fieldsToUpdate["Date and Time Scheduled"] = `${date}T${timePart}:00+08:00`
    } else if (status === "Completed" || status === "Complete") {
      fieldsToUpdate["Date and Time Scheduled"] = null
    }

    let airtableRes: any = null

    if (tableId && tableId.startsWith("tbl")) {
      try {
        // 1. Primary update targeting 'Date and Time Scheduled' with normalized Status
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

        if (patchRes.ok) {
          airtableRes = await patchRes.json()
        } else {
          const errText = await patchRes.text()
          console.warn(`Primary Airtable patch to table ${tableId} failed: ${patchRes.status} ${errText}`)

          // 2. Fallback: If table uses "Completed" instead of "Complete"
          if (fieldsToUpdate["Status"] === "Complete") {
            const completedFields = { ...fieldsToUpdate, Status: "Completed" }
            const completedRes = await fetch(
              `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
              {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ fields: completedFields }),
              }
            )
            if (completedRes.ok) {
              airtableRes = await completedRes.json()
            }
          }

          // 3. Fallback: If table uses legacy 'Date and Time' field name instead
          if (!airtableRes && fieldsToUpdate["Date and Time Scheduled"] !== undefined) {
            const legacyFields: Record<string, any> = { ...fieldsToUpdate }
            legacyFields["Date and Time"] = legacyFields["Date and Time Scheduled"]
            delete legacyFields["Date and Time Scheduled"]

            const legacyRes = await fetch(
              `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
              {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ fields: legacyFields }),
              }
            )

            if (legacyRes.ok) {
              airtableRes = await legacyRes.json()
            }
          }

          // 3. Fallback: Status only if date fields are completely missing from schema
          if (!airtableRes) {
            const statusOnlyRes = await fetch(
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
            if (statusOnlyRes.ok) {
              airtableRes = await statusOnlyRes.json()
            }
          }
        }
      } catch (patchErr) {
        console.error("Error updating Airtable record:", patchErr)
      }
    }

    return NextResponse.json({
      status: "success",
      recordId,
      tableId,
      updated: fieldsToUpdate,
      airtableResponse: airtableRes,
    })
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", error: error?.message || "Failed to update record" },
      { status: 500 }
    )
  }
}
