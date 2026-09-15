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
  it("extracts Moodboard #2 feed slides from alternative candidate field names", () => {
    expect(extractMediaFromRecord({ "FEED - Moodboard #2 Feed (3)": img("https://media.example/mb2-feed") }, "Feeds", "Moodboard #2").slides)
      .toEqual(["https://media.example/mb2-feed"])
    expect(extractMediaFromRecord({ "Converted Moodboard": img("https://media.example/mb2-converted") }, "Feeds", "Moodboard #2").slides)
      .toEqual(["https://media.example/mb2-converted"])
  })
  it("combines cover thumbnail and feed slides for Tips & Educational Feeds", () => {
    const record = {
      "Thumbnail with Text": img("https://media.example/cover.jpg"),
      "Tips and Edu Feeds": [
        { url: "https://media.example/feed1.jpg", type: "image/jpeg" },
        { url: "https://media.example/feed2.jpg", type: "image/jpeg" },
        { url: "https://media.example/feed3.jpg", type: "image/jpeg" },
      ],
    }
    const result = extractMediaFromRecord(record, "Feeds", "Tips & Educational")
    expect(result.slides).toEqual([
      "https://media.example/cover.jpg",
      "https://media.example/feed1.jpg",
      "https://media.example/feed2.jpg",
      "https://media.example/feed3.jpg",
    ])
    expect(result.mediaUrl).toBe("https://media.example/cover.jpg")
  })
  it("extracts Product Closeup w/ Description from both Converted and Layout fields without fallback to unrelated fields", () => {
    expect(extractMediaFromRecord({ "Product Closeup Description Converted": img("https://media.example/pcd-conv.jpg") }, "Stories", "Product Closeup w/ description").mediaUrl)
      .toBe("https://media.example/pcd-conv.jpg")
    expect(extractMediaFromRecord({ "Product Closeup Description Layout": img("https://media.example/pcd-layout.jpg") }, "Stories", "Product Closeup w/ description").mediaUrl)
      .toBe("https://media.example/pcd-layout.jpg")
    expect(extractMediaFromRecord({ "Unrelated Attachment": img("https://media.example/random.jpg") }, "Stories", "Product Closeup w/ description").mediaUrl)
      .toBe("")
  })
})

describe("canonical Foreign Key ID derivation", () => {
  it("derives MB2-FEEDS prefix for Moodboard #2 feeds", () => {
    expect(deriveForeignKeyId({ ID: 7 }, "Feeds", "Moodboard #2", "Chandelier")).toBe("MB2-FEEDS-CH-7")
    expect(deriveForeignKeyId({ ID: 15 }, "Feeds", "Moodboard #2", "Pendant Light")).toBe("MB2-FEEDS-PE-15")
  })
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
  it("never falls back to raw recordId (rec...) and derives canonical Foreign Key ID instead", () => {
    expect(deriveForeignKeyId({}, "Reels", "Before & After", "Pendant Light", "recFallback123")).toBe("BA-REEL-PE-1")
    expect(deriveForeignKeyId({}, "Stories", "Collection Category", "Chandelier", "recp1JxFduXp1UqUk", 5)).toBe("CC-STORY-CH-5")
  })
  it("maps fixture abbreviations correctly according to Airtable conventions", () => {
    expect(deriveForeignKeyId({ ID: 1 }, "Stories", "CTA Story", "Table Lamp")).toBe("CTA-STORY-TL-1")
    expect(deriveForeignKeyId({ ID: 2 }, "Stories", "Collection Category", "Wall Light")).toBe("CC-STORY-WL-2")
    expect(deriveForeignKeyId({ ID: 3 }, "Stories", "CTA Story", "Cluster Chandelier")).toBe("CTA-STORY-CL-3")
    expect(deriveForeignKeyId({ ID: 4 }, "Stories", "Tips & Educational", "Ceiling Mounted")).toBe("TNE-STORY-CM-4")
    expect(deriveForeignKeyId({ ID: 19 }, "Feeds", "Collection Category", "")).toBe("CC-FEEDS-SET-19")
  })
})
