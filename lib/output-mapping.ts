export function getFinalOutputCandidates(category: string, contentType: string): string[] {
  const cat = category.toLowerCase().trim()
  const type = contentType.toLowerCase().trim()

  if (cat === "stories") {
    if (type.includes("collection")) return ["Collection Category Converted", "STORY - Collection Category (1)"]
    if (type.includes("myth") || type.includes("fact")) return ["STORY - Myth & Fact (4)"]
    if (type.includes("description") || (type.includes("closeup") && !type.includes("spec"))) return ["Product Closeup Description Converted"]
    if (type.includes("tips")) return ["Tips and Edu Story Converted", "Tips and Edu Stories"]
    if (type.includes("day") && type.includes("night")) return ["STORY - Day & Night (2)"]
    if (type.includes("moodboard")) return ["Moodboard Converted", "Blended Image"]
    if (type.includes("spec")) return ["PCS Story"]
    if (type.includes("style this")) return ["STORY - Style This? (4)"]
    if (type.includes("this or that")) return ["Story This or That (1)", "STORY - This or That (1)", "This or That Converted"]
    if (type.includes("cta")) return ["CTA Converted Image"]
  }

  if (cat === "feeds") {
    if (type.includes("tips")) {
      return [
        "Thumbnail with Text",
        "Thumbnail",
        "Tips and Edu Feeds",
        "Tips and Edu Blended Attach Item Name",
        "FEED - Tips & Educational (4)",
      ]
    }
    if (type.includes("day") && type.includes("night")) return ["FEED - Day & Night (2)", "Day Image"]
    if (type.includes("collection")) return ["FEED - Collection Category (4)", "Styled Photo - Collection Category"]
    if (type.includes("1 product") || type.includes("one product") || type.includes("3 styles")) return ["FEED - 1 Product, 3 Styles (3)"]
    if (type.includes("moodboard #2") || type.includes("moodboard 2") || type.includes("revised moodboard")) {
      return [
        "FEED - Revised Moodboard (3)",
        "FEED - Moodboard #2 Feed (3)",
        "FEED - Moodboard #2 (3)",
        "Moodboard #2 Feed (3)",
        "Moodboard #2 (3)",
        "FEED - Moodboard (3)",
        "Revised Moodboard",
        "Converted Moodboard",
        "Moodboard Converted",
        "Blended Image",
      ]
    }
    if (type.includes("moodboard #1") || type.includes("moodboard 1") || type.includes("moodboard")) {
      return [
        "FEED - Moodboard #1 Feed (3)",
        "FEED - Moodboard #1 (3)",
        "Moodboard #1 Feed (3)",
        "Converted Moodboard",
        "Moodboard Converted",
        "Blended Image",
      ]
    }
    if (type.includes("product showcase") || type.includes("showcase")) return ["FEED - Product Showcase Feed"]
    if (type.includes("closeup") || type.includes("carousel")) return ["FEED - Carousel Product Closeup (3)"]
  }

  if (cat === "reels") {
    if (type.includes("day") && type.includes("night")) return ["Day and Night Reel with Music and Outro", "REEL - Day & Night"]
    if (type.includes("1 product") || type.includes("one product") || type.includes("3 styles")) return ["Converted Reel", "REEL - 1 Product, 3 Styles"]
    if (type.includes("before") && type.includes("after")) return ["Slide Show Before and After Reel", "REEL - Before & After", "Slide Show Before and After"]
    if (type.includes("moodboard")) return ["REEL - Moodboard Reel", "Converted Moodboard Reel"]
    if (type.includes("style")) return ["Style Reel Slideshow", "REEL - Style Reel Slideshow"]
    if (type.includes("closeup")) return ["Final Video", "REEL - Product Closeup", "Product Closeup Reel"]
  }

  return []
}

export function getFinalOutputField(category: string, contentType: string): string | null {
  const candidates = getFinalOutputCandidates(category, contentType)
  return candidates.length > 0 ? candidates[0] : null
}
