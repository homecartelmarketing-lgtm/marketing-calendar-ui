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
