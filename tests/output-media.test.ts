import { describe, expect, it } from "vitest"
import { extractMediaFromRecord } from "@/lib/schedules"

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
