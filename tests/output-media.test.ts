import { describe, expect, it } from "vitest"
import { extractMediaFromRecord } from "@/lib/schedules"
import { deriveForeignKeyId } from "@/lib/output-media"

const img = (url: string) => [{ url, type: "image/jpeg", filename: "image.jpg" }]
describe("scheduler final media selection", () => {
  it("includes both moodboard slides in declared order regardless of field order", () => {
    expect(extractMediaFromRecord({ "Blended Image": img("https://media.example/second"), "Moodboard Converted": img("https://media.example/first") }, "Stories", "Moodboard Story").slides)
      .toEqual(["https://media.example/first", "https://media.example/second"])
  })
  it("includes both day and night feed slides instead of publishing only daytime", () => {
    expect(extractMediaFromRecord({ "Night Image": img("https://media.example/night"), "Day Image": img("https://media.example/day") }, "Feeds", "Day & Night").slides)
      .toEqual(["https://media.example/day", "https://media.example/night"])
  })
  it("does not publish an input image when final CTA output is missing", () => {
    expect(extractMediaFromRecord({ "Interior": img("https://media.example/private-draft") }, "Stories", "CTA Story").slides).toEqual([])
  })
  it("does not treat a JPG in a Reel-named field as a video", () => {
    expect(extractMediaFromRecord({ "Final Video": img("https://media.example/thumbnail") }, "Reels", "Product Closeup").mediaUrl).toBe("")
  })
  it("uses video MIME metadata for signed URLs without file extensions", () => {
    expect(extractMediaFromRecord({ "Final Video": [{ url: "https://media.example/signed?token=fixture", type: "video/mp4" }] }, "Reels", "Product Closeup"))
      .toEqual({ mediaUrl: "https://media.example/signed?token=fixture", mediaType: "video", slides: ["https://media.example/signed?token=fixture"] })
  })
})

describe("canonical Foreign Key ID derivation", () => {
  it("preserves explicit Foreign Key ID from Airtable", () => {
    expect(deriveForeignKeyId({ "Foreign Key ID": "BA-REEL-CH-2", ID: 2 }, "Reels", "Before & After", "Chandelier")).toBe("BA-REEL-CH-2")
  })
  it("preserves explicit CID from Airtable", () => {
    expect(deriveForeignKeyId({ CID: "CUSTOM-CID-99", ID: 99 }, "Reels", "Before & After", "Pendant Light")).toBe("CUSTOM-CID-99")
  })
  it("derives BA-REEL prefix for Before & After reels when Foreign Key ID is missing in table", () => {
    expect(deriveForeignKeyId({ ID: 10 }, "Reels", "Before & After", "Pendant Light")).toBe("BA-REEL-PE-10")
    expect(deriveForeignKeyId({ ID: 3 }, "Reels", "Before & After", "Pendant Light")).toBe("BA-REEL-PE-3")
  })
  it("derives DN-REEL prefix for Day & Night reels", () => {
    expect(deriveForeignKeyId({ ID: 5 }, "Reels", "Day & Night", "Chandelier")).toBe("DN-REEL-CH-5")
  })
  it("derives CTA-STORY prefix for CTA stories", () => {
    expect(deriveForeignKeyId({ ID: 12 }, "Stories", "CTA Story", "Chandelier")).toBe("CTA-STORY-CH-12")
  })
  it("derives TNE-FEEDS prefix for Tips & Educational feeds", () => {
    expect(deriveForeignKeyId({ ID: 9 }, "Feeds", "Tips & Educational", "Pendant Light")).toBe("TNE-FEEDS-PE-9")
  })
  it("falls back to recordId when no ID field exists", () => {
    expect(deriveForeignKeyId({}, "Reels", "Before & After", "Pendant Light", "recFallback123")).toBe("recFallback123")
  })
})
