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
  } else if (cat === "feeds" && type.includes("collection")) {
    const blendedSlides = [
      ...read("Blended Image1"),
      ...read("Blended Image2"),
      ...read("Blended Image3"),
      ...read("Blended Image4"),
      ...read("Blended Image5"),
    ]
    if (blendedSlides.length > 0) {
      selected = blendedSlides
    } else {
      for (const candidate of getFinalOutputCandidates(category, idea)) {
        const attachments = read(candidate).filter(item => attachmentType(item) !== null)
        if (attachments.length) { selected = attachments; break }
      }
    }
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

export function getFixtureCode(fixtureType?: string): string {
  if (!fixtureType) return "SET"
  const norm = fixtureType.toLowerCase().trim()
  if (norm.includes("table")) return "TL"
  if (norm.includes("wall")) return "WL"
  if (norm.includes("floor")) return "FL"
  if (norm.includes("pendant")) return "PE"
  if (norm.includes("cluster")) return "CL"
  if (norm.includes("linear")) return "LC"
  if (norm.includes("ceiling")) return "CM"
  if (norm.includes("chandelier")) return "CH"
  return fixtureType.slice(0, 2).toUpperCase() || "FX"
}

export function getForeignKeyPrefix(
  category: string,
  idea: string,
  fixtureType?: string
): string {
  const cat = category.toLowerCase().trim()
  const type = idea.toLowerCase().trim()
  const fxCode = getFixtureCode(fixtureType)

  // Reels
  if (cat === "reels") {
    if (type.includes("before") && type.includes("after")) {
      return `BA-REEL-${fxCode}`
    }
    if (type.includes("day") && type.includes("night")) {
      return `DN-REEL-${fxCode}`
    }
    if (type.includes("moodboard")) {
      return `MB-REEL-${fxCode}`
    }
    if (type.includes("1 product") || type.includes("3 styles")) {
      return `1P3S-REEL-${fxCode}`
    }
    if (type.includes("slideshow") || type.includes("style reel")) {
      return `SR-REEL-${fxCode}`
    }
    if (type.includes("closeup")) {
      return `PC-REEL-${fxCode}`
    }
    return `REEL-${fxCode}`
  }

  // Stories
  if (cat === "stories") {
    if (type.includes("cta")) {
      return `CTA-STORY-${fxCode}`
    }
    if (type.includes("moodboard")) {
      return `MB-STORY-${fxCode}`
    }
    if (type.includes("this or that")) {
      return `TOT-STORY-${fxCode}`
    }
    if (type.includes("day") && type.includes("night")) {
      return `DN-STORY-${fxCode}`
    }
    if (type.includes("myth") || type.includes("fact")) {
      return `MF-STORY-${fxCode}`
    }
    if (type.includes("style this")) {
      return `ST-STORY-${fxCode}`
    }
    if (type.includes("tips")) {
      return `TNE-STORY-${fxCode}`
    }
    if (type.includes("collection")) {
      return `CC-STORY-${fxCode}`
    }
    if (type.includes("description") || type.includes("pcd")) {
      return `PCD-STORY-${fxCode}`
    }
    if (type.includes("spec") || type.includes("pcs")) {
      return `PCS-STORY-${fxCode}`
    }
    if (type.includes("closeup")) {
      return `PCD-STORY-${fxCode}`
    }
    return `STORY-${fxCode}`
  }

  // Feeds
  if (cat === "feeds") {
    if (type.includes("tips")) {
      return `TNE-FEEDS-${fxCode}`
    }
    if (type.includes("day") && type.includes("night")) {
      return `DN-FEEDS-${fxCode}`
    }
    if (type.includes("moodboard #2") || type.includes("moodboard 2")) {
      return `MB2-FEEDS-${fxCode}`
    }
    if (type.includes("moodboard")) {
      return `MB1-FEEDS-${fxCode}`
    }
    if (type.includes("1 product") || type.includes("3 styles")) {
      return `1P3S-FEEDS-${fxCode}`
    }
    if (type.includes("collection")) {
      return `CC-FEEDS-${fxCode}`
    }
    if (type.includes("showcase")) {
      return `PS-FEEDS-${fxCode}`
    }
    return `FEED-${fxCode}`
  }

  return `CID-${fxCode}`
}

/** Canonical derivation of Foreign Key IDs (CIDs) across Feeds, Stories, and Reels. */
export function deriveForeignKeyId(
  fields: Record<string, unknown>,
  category: string,
  idea: string,
  fixtureType?: string,
  fallbackId?: string,
  fallbackIndex?: number
): string {
  if (typeof fields["Foreign Key ID"] === "string" && fields["Foreign Key ID"].trim()) {
    return fields["Foreign Key ID"].trim()
  }
  if (typeof fields["CID"] === "string" && fields["CID"].trim()) {
    return fields["CID"].trim()
  }
  if (typeof fields["Foreign Key"] === "string" && fields["Foreign Key"].trim()) {
    return fields["Foreign Key"].trim()
  }

  let rawId = fields["ID"]
  if (rawId === undefined || rawId === null || rawId === "") {
    rawId = fields["ID (from Lighting Fixture)"]
  }
  if (Array.isArray(rawId)) {
    rawId = rawId[0]
  }
  if (rawId === undefined || rawId === null || rawId === "") {
    rawId = fields["Auto ID"] || fields["Item ID"] || fields["No."] || fields["Number"]
  }

  const prefix = getForeignKeyPrefix(category, idea, fixtureType)

  if (rawId !== undefined && rawId !== null && rawId !== "") {
    return `${prefix}-${rawId}`
  }

  if (fallbackIndex !== undefined && fallbackIndex !== null && fallbackIndex > 0) {
    return `${prefix}-${fallbackIndex}`
  }

  // If fallbackId is provided and NOT a raw Airtable record ID (rec...), use it
  if (fallbackId && typeof fallbackId === "string" && fallbackId.trim()) {
    const trimmed = fallbackId.trim()
    if (!/^rec[a-zA-Z0-9]{10,}$/.test(trimmed)) {
      if (trimmed.includes("-")) return trimmed
      return `${prefix}-${trimmed}`
    }
  }

  // Never fall back to a raw Airtable record ID (rec...)
  return `${prefix}-1`
}

