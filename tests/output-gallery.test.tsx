// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { UniversalContentGallery } from "@/components/universal-content-gallery"

afterEach(cleanup)
const item = (id: string) => ({ recordId: id, tableId: "tblTest", category: "Stories", contentType: "CTA Story", foreignKeyId: id,
  status: "Completed", rawStatus: "Completed", date: "", time: "", mediaType: "image", slides: [`https://media.example/${id}.jpg`], caption: "", airtableUrl: "", itemNames: [] })

it("ignores an old request that finishes after the user switches categories", async () => {
  let finishOld!: (response: Response) => void
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("category=Stories")
    ? new Promise<Response>(resolve => { finishOld = resolve })
    : Response.json({ items: [item("recNew")] })))
  const view = render(<UniversalContentGallery category="Stories" contentType="CTA Story" onBackToCalendar={() => {}} />)
  view.rerender(<UniversalContentGallery category="Feeds" contentType="Tips & Educational" onBackToCalendar={() => {}} />)
  await screen.findByAltText("Slide 1 for recNew")
  await act(async () => { finishOld(Response.json({ items: [item("recOld")] })) })
  expect(screen.queryByAltText("Slide 1 for recOld")).toBeNull()
  expect(screen.queryByAltText("Slide 1 for recNew")).not.toBeNull()
})

it("shows the remaining cards after refresh shrinks the current page", async () => {
  let items = [item("rec1"), item("rec2"), item("rec3"), item("rec4")]
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items })))
  render(<UniversalContentGallery category="Stories" contentType="CTA Story" onBackToCalendar={() => {}} />)
  await screen.findByAltText("Slide 1 for rec1")
  fireEvent.click(screen.getByRole("button", { name: "Next page" }))
  expect(screen.queryByAltText("Slide 1 for rec4")).not.toBeNull()
  items = [item("rec1")]
  fireEvent.click(screen.getByRole("button", { name: "Sync Airtable" }))
  await waitFor(() => expect(screen.queryByText("Loading automation outputs...")).toBeNull())
  expect(screen.queryByAltText("Slide 1 for rec1")).not.toBeNull()
})

it("shows a partial-read warning while keeping successful cards visible", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [item("rec1")], diagnostics: { partial: true, failedTables: 2 } })))
  render(<UniversalContentGallery category="Stories" contentType="CTA Story" onBackToCalendar={() => {}} />)
  await screen.findByAltText("Slide 1 for rec1")
  expect(screen.queryByText(/2 output tables could not be loaded/)).not.toBeNull()
})
