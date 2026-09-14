import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || ""
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appDM0jUDsaiThtR3"
const MARKETING_AUTOMATION_DIR =
  process.env.MARKETING_AUTOMATION_DIR || "C:\\Users\\User\\marketing-automation"

const TABLES = [
  { id: "tblIhCP3Gjg09QFCK", category: "Pendant Lights" },
  { id: "tblQ65S51Dmauwx4c", category: "Chandeliers" },
  { id: "tblQuhvktqYB59Ofw", category: "Floor Lamps" },
  { id: "tblwY6eGQCD5bJeF1", category: "Cluster Chandeliers" },
]

export type OutputCardItem = {
  recordId: string
  tableId?: string
  category: string
  foreignKeyId: string
  status: "Completed" | "Scheduled" | "Posted" | "For Manual" | "Discard"
  rawStatus: string
  date: string
  time: string
  slides: string[]
  caption: string
  airtableUrl: string
  itemNames: string[]
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

export async function GET() {
  try {
    const allItems: OutputCardItem[] = []

    for (const table of TABLES) {
      try {
        const res = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table.id}?pageSize=100`,
          {
            headers: {
              Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            },
            next: { revalidate: 10 },
          }
        )

        if (!res.ok) {
          console.error(`Airtable error for table ${table.id}:`, res.status)
          continue
        }

        const data = await res.json()
        const records = data.records || []

        for (const rec of records) {
          const fields = rec.fields || {}

          const rawFeeds = fields["Tips and Edu Feeds"] || []
          const rawThumb = fields["Thumbnail with Text"] || fields["Thumbnail"] || []

          const hasFeeds = Array.isArray(rawFeeds) && rawFeeds.length > 0
          const hasThumb = Array.isArray(rawThumb) && rawThumb.length > 0

          // Check if local artifact folder exists
          const artifactDir = path.join(
            MARKETING_AUTOMATION_DIR,
            "output",
            "tips_and_edu_feed",
            "artifacts",
            rec.id
          )
          const localExists = fs.existsSync(artifactDir)

          // Only keep items that have actual output generated
          if (!hasFeeds && !hasThumb && !localExists) {
            continue
          }

          const slides: string[] = []

          // 1. Cover Slide
          if (hasThumb) {
            slides.push(rawThumb[0].url)
          } else if (localExists) {
            const thumbCandidate = path.join(artifactDir, `thumbnail_with_text_${rec.id}.jpg`)
            const rawCandidate = path.join(artifactDir, `thumbnail_raw_${rec.id}.jpg`)
            if (fs.existsSync(thumbCandidate)) {
              slides.push(`/api/media/tips_and_edu_feed/artifacts/${rec.id}/thumbnail_with_text_${rec.id}.jpg`)
            } else if (fs.existsSync(rawCandidate)) {
              slides.push(`/api/media/tips_and_edu_feed/artifacts/${rec.id}/thumbnail_raw_${rec.id}.jpg`)
            }
          }

          // 2. Feed Layout Slides
          if (hasFeeds) {
            for (const item of rawFeeds) {
              if (item?.url) slides.push(item.url)
            }
          } else if (localExists) {
            for (let i = 1; i <= 3; i++) {
              const slideFile = path.join(artifactDir, `tips_and_edu_feed_${i}_${rec.id}.jpg`)
              if (fs.existsSync(slideFile)) {
                slides.push(`/api/media/tips_and_edu_feed/artifacts/${rec.id}/tips_and_edu_feed_${i}_${rec.id}.jpg`)
              }
            }
          }

          if (slides.length === 0) continue

          const rawStatus = fields["Status"] || "Completed"
          const status = normalizeStatus(rawStatus)

          const genDateField =
            fields["Date and Time Generated"] ||
            fields["Date and Time Run (PHT)"] ||
            fields["Date & Time Run (PHT)"]
          const { date, time } = formatDateDisplay(genDateField)

          const fkId =
            fields["Foreign Key ID"] ||
            fields["CID"] ||
            (fields["ID"] ? `TNE-FEEDS-${table.category.slice(0, 2).toUpperCase()}-${fields["ID"]}` : rec.id)

          const itemNames: string[] = []
          for (let i = 1; i <= 4; i++) {
            const key = i === 1 ? "Item Name" : `Item Name${i}`
            if (fields[key]) itemNames.push(String(fields[key]))
          }

          const caption = fields["Caption"] || fields["Generated Caption"] || ""

          allItems.push({
            recordId: rec.id,
            tableId: table.id,
            category: table.category,
            foreignKeyId: fkId,
            status,
            rawStatus: String(rawStatus),
            date,
            time,
            slides,
            caption: String(caption).trim(),
            airtableUrl: `https://airtable.com/${AIRTABLE_BASE_ID}/${table.id}/${rec.id}`,
            itemNames,
          })
        }
      } catch (err) {
        console.error(`Error querying table ${table.id}:`, err)
      }
    }

    return NextResponse.json({
      status: "success",
      total: allItems.length,
      items: allItems,
    })
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", error: error?.message || "Failed to fetch outputs" },
      { status: 500 }
    )
  }
}
