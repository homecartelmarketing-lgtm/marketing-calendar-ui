export function getFinalOutputField(category: string, contentType: string): string | null {
  const cat = category.toLowerCase().trim()
  const type = contentType.toLowerCase().trim()

  if (cat === "stories") {
    if (type.includes("collection")) return "Collection Category Converted"
    if (type.includes("myth") || type.includes("fact")) return "STORY - Myth & Fact (4)"
    if (type.includes("description") || (type.includes("closeup") && !type.includes("spec"))) return "Product Closeup Description Converted"
    if (type.includes("tips")) return "Tips and Edu Story Converted"
    if (type.includes("day") && type.includes("night")) return "STORY - Day & Night (2)"
    if (type.includes("moodboard")) return "Moodboard Converted"
    if (type.includes("spec")) return "PCS Story"
    if (type.includes("style this")) return "STORY - Style This? (4)"
    if (type.includes("this or that")) return "This or That Converted"
    if (type.includes("cta")) return "CTA Converted Image"
  }

  if (cat === "feeds") {
    if (type.includes("day") && type.includes("night")) return "FEED - Day & Night (2)"
    if (type.includes("product showcase") || type.includes("showcase feed")) return "FEED - Product Showcase Feed"
    if (type.includes("tips")) return "Tips and Edu Blended Attach Item Name"
  }

  if (cat === "reels") {
    if (type.includes("day") && type.includes("night")) return "REEL - Day & Night"
  }

  return null
}
