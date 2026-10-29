import { expect, it } from "vitest"
import { extractCaption } from "@/lib/caption"

it("reads standard caption column names in priority order", () => {
  for (const key of ["Caption Generated", "Generated Caption", "Caption"]) {
    expect(extractCaption({ [key]: "  Hello  " })).toBe("Hello")
  }
})

it("prioritizes Caption Generated over other caption columns regardless of key order", () => {
  expect(
    extractCaption({
      Caption: "Legacy caption",
      "Caption Generated": "Primary generated caption",
    })
  ).toBe("Primary generated caption")

  expect(
    extractCaption({
      "Generated Caption": "Old generated caption",
      "Caption Generated": "Official generated caption",
    })
  ).toBe("Official generated caption")
})

it("unwraps single-element array lookup values", () => {
  expect(extractCaption({ "Caption Generated": ["  Unwrapped lookup caption  "] })).toBe("Unwrapped lookup caption")
})

it("returns empty for missing, blank or non-string/non-array values", () => {
  expect(extractCaption({})).toBe("")
  expect(extractCaption({ "Caption Generated": "   " })).toBe("")
  expect(extractCaption({ "Caption Generated": 5 })).toBe("")
  expect(extractCaption({ "Caption Generated": [] })).toBe("")
})

it("skips an empty caption column and uses the next populated fallback", () => {
  expect(extractCaption({ "Caption Generated": "", Caption: "Real fallback caption" })).toBe("Real fallback caption")
})

