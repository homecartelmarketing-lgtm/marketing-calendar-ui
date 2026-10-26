import { beforeEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { utils, write } from "xlsx"
import { GET, MAX_UPLOAD_BYTES, POST } from "@/app/api/calendar/route"
import { resetCalendarStoreForTests } from "@/server/calendar/store"

function workbookFile(
  sheetName: string,
  dateSerial: number,
  day: number,
  idea: string,
): File {
  const rows: unknown[][] = []
  rows[2] = [dateSerial]
  rows[4] = [day]
  rows[5] = ["Feeds", idea, 14 / 24, "To Do"]

  const sheet = utils.aoa_to_sheet(rows)
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, sheet, sheetName)
  const buffer = write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer

  return new File([buffer], `${sheetName}.xlsx`, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

function csvFile(name: string, text: string): File {
  return new File([text], name, { type: "text/csv" })
}

function postFile(file?: File): NextRequest {
  const form = new FormData()
  if (file) form.append("file", file)
  return new NextRequest("http://localhost/api/calendar", { method: "POST", body: form })
}

describe("calendar API", () => {
  beforeEach(() => {
    resetCalendarStoreForTests()
  })

  it("saves a November workbook and returns it on GET", async () => {
    const response = await POST(postFile(workbookFile("November", 46327, 1, "One Light at a Time")))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.savedMonths).toEqual(["2026-11"])
    expect(body.dayCount).toBe(1)

    const snapshot = await (await GET()).json()
    expect(snapshot.months).toEqual(["2026-11"])
    expect(snapshot.days["2026-11-01"][0].idea).toBe("One Light at a Time")
    expect(snapshot.imports[0].sourceFile).toBe("November.xlsx")
  })

  it("saves a January 2027 workbook without any code change", async () => {
    const response = await POST(postFile(workbookFile("January", 46388, 1, "New Year")))

    expect(response.status).toBe(200)
    expect((await response.json()).savedMonths).toEqual(["2027-01"])
  })

  it("persists a columnar CSV", async () => {
    const response = await POST(
      postFile(csvFile("december.csv", "date,type,idea,time\n2026-12-01,Feeds,Holiday,14:00")),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.savedMonths).toEqual(["2026-12"])
    expect(body.dayCount).toBe(1)
  })

  it("rejects a missing file", async () => {
    const response = await POST(postFile())
    expect(response.status).toBe(400)
  })

  it("rejects a workbook with no calendar entries", async () => {
    const response = await POST(postFile(workbookFile("November", 46327, 1, "")))
    expect(response.status).toBe(400)
  })

  it("rejects a CSV whose rows have no date", async () => {
    const response = await POST(postFile(csvFile("undated.csv", "date,type,idea\n,Feeds,Holiday")))
    expect(response.status).toBe(400)
  })

  it("rejects uploads larger than the cap", async () => {
    const oversized = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "big.xlsx")
    const response = await POST(postFile(oversized))
    expect(response.status).toBe(413)
  })
})
