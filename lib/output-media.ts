import { getFinalOutputCandidates } from "@/lib/output-mapping"

type Attachment = { url: string; type?: string; filename?: string }
type OutputMedia = { mediaUrl: string; mediaType: "image" | "video"; slides: string[] }

function attachmentType(item: Attachment): "image" | "video" | null {
  const mime = item.type?.toLowerCase()
  if (mime?.startsWith("video/")) return "video"
  if (mime?.startsWith("image/")) return "image"
  if (mime && mime !== "application/octet-stream") return null
  const name = item.filename || new URL(item.url).pathname
  if (/\.(mp4|mov|webm|m4v)$/i.test(name)) return "video"
  if (/\.(jpg|jpeg|png|webp|gif|avif)$/i.test(name)) return "image"
  return null
}

/** Only known final-output fields are eligible. Field order is never slide order. */
export function extractOutputMedia(fields: Record<string, unknown>, category: string, idea = ""): OutputMedia {
  const empty: OutputMedia = { mediaUrl: "", mediaType: category.toLowerCase() === "reels" ? "video" : "image", slides: [] }
  const normalized = new Map(Object.entries(fields).map(([key, value]) => [key.trim().toLowerCase(), value]))
  const read = (name: string): Attachment[] => {
    const value = normalized.get(name.toLowerCase())
    if (!Array.isArray(value)) return []
    return value.filter((item): item is Attachment => {
      if (!item || typeof item.url !== "string") return false
      try { return ["http:", "https:"].includes(new URL(item.url).protocol) } catch { return false }
    })
  }
  const cat = category.toLowerCase()
  const type = idea.toLowerCase()
  let selected: Attachment[] = []
  if (cat === "stories" && type.includes("moodboard")) {
    selected = [...read("Moodboard Converted"), ...read("Blended Image")]
  } else if (cat === "feeds" && ((type.includes("day") && type.includes("night")) || type.includes("d&n"))) {
    const day = read("Day Image")[0]
    const night = read("Night Image")[0]
    selected = day && night ? [day, night] : read("FEED - Day & Night (2)")
  } else if (cat === "feeds" && type.includes("tips")) {
    const cover = read("Thumbnail with Text")[0] || read("Thumbnail")[0]
    const feeds = read("Tips and Edu Feeds")
    selected = cover ? [cover, ...feeds] : feeds.length ? feeds : read("Tips and Edu Blended Attach Item Name")
  } else {
    for (const candidate of getFinalOutputCandidates(category, idea)) {
      const attachments = read(candidate).filter(item => cat === "reels" ? attachmentType(item) === "video" : attachmentType(item) !== null)
      if (attachments.length) { selected = attachments; break }
    }
  }
  selected = selected.filter(item => cat === "reels" ? attachmentType(item) === "video" : attachmentType(item) !== null)
  if (!selected.length) return empty
  const mediaType = attachmentType(selected[0])!
  const slides = selected.map(item => item.url)
  return { mediaUrl: slides[0], mediaType, slides }
}

/** Canonical derivation of Foreign Key IDs (CIDs) across Feeds, Stories, and Reels. */
export function deriveForeignKeyId(
  fields: Record<string, unknown>,
  category: string,
  idea: string,
  fixtureType?: string,
  fallbackId?: string
): string {
  if (typeof fields["Foreign Key ID"] === "string" && fields["Foreign Key ID"].trim()) {
    return fields["Foreign Key ID"].trim()
  }
  if (typeof fields["CID"] === "string" && fields["CID"].trim()) {
    return fields["CID"].trim()
  }

  const rawId = fields["ID"]
  if (rawId === undefined || rawId === null || rawId === "") {
    return fallbackId || ""
  }

  const cat = category.toLowerCase().trim()
  const type = idea.toLowerCase().trim()
  const fxCode = fixtureType ? fixtureType.slice(0, 2).toUpperCase() : "FX"

  // Reels
  if (cat === "reels") {
    if (type.includes("before") && type.includes("after")) {
      return `BA-REEL-${fxCode}-${rawId}`
    }
    if (type.includes("day") && type.includes("night")) {
      return `DN-REEL-${fxCode}-${rawId}`
    }
    if (type.includes("moodboard")) {
      return `MB-REEL-${fxCode}-${rawId}`
    }
    if (type.includes("1 product") || type.includes("3 styles")) {
      return `1P3S-REEL-${fxCode}-${rawId}`
    }
    if (type.includes("closeup")) {
      return `PC-REEL-${fxCode}-${rawId}`
    }
    return `REEL-${fxCode}-${rawId}`
  }

  // Stories
  if (cat === "stories") {
    if (type.includes("cta")) {
      return `CTA-STORY-${fxCode}-${rawId}`
    }
    if (type.includes("moodboard")) {
      return `MB-STORY-${fxCode}-${rawId}`
    }
    if (type.includes("this or that")) {
      return `TOT-STORY-${fxCode}-${rawId}`
    }
    if (type.includes("day") && type.includes("night")) {
      return `DN-STORY-${fxCode}-${rawId}`
    }
    if (type.includes("myth") || type.includes("fact")) {
      return `MF-STORY-${fxCode}-${rawId}`
    }
    if (type.includes("style this")) {
      return `ST-STORY-${fxCode}-${rawId}`
    }
    if (type.includes("tips")) {
      return `TNE-STORY-${fxCode}-${rawId}`
    }
    if (type.includes("collection")) {
      return `CC-STORY-${fxCode}-${rawId}`
    }
    if (type.includes("description") || type.includes("closeup")) {
      return `PCD-STORY-${fxCode}-${rawId}`
    }
    if (type.includes("spec")) {
      return `PCS-STORY-${fxCode}-${rawId}`
    }
    return `STORY-${fxCode}-${rawId}`
  }

  // Feeds
  if (cat === "feeds") {
    if (type.includes("tips")) {
      return `TNE-FEEDS-${fxCode}-${rawId}`
    }
    if (type.includes("day") && type.includes("night")) {
      return `DN-FEEDS-${fxCode}-${rawId}`
    }
    if (type.includes("moodboard #2") || type.includes("moodboard 2")) {
      return `MB2-FEEDS-${fxCode}-${rawId}`
    }
    if (type.includes("moodboard")) {
      return `MB1-FEEDS-${fxCode}-${rawId}`
    }
    if (type.includes("1 product") || type.includes("3 styles")) {
      return `1P3S-FEEDS-${fxCode}-${rawId}`
    }
    if (type.includes("collection")) {
      return `CC-FEEDS-${fxCode}-${rawId}`
    }
    if (type.includes("showcase")) {
      return `PS-FEEDS-${fxCode}-${rawId}`
    }
    return `FEED-${fxCode}-${rawId}`
  }

  return `CID-${rawId}`
}
