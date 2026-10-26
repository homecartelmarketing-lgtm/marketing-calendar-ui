import { NextRequest, NextResponse } from "next/server"
import { parseContentCsv } from "@/lib/csv"
import { monthsFromDays } from "@/lib/calendar-months"
import { parseContentWorkbook } from "@/lib/workbook"
import {
  CalendarStorageUnavailable,
  loadCalendar,
  saveCalendar,
} from "@/server/calendar/store"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET() {
  try {
    const snapshot = await loadCalendar()
    return NextResponse.json({ success: true, ...snapshot })
  } catch (error) {
    if (error instanceof CalendarStorageUnavailable) {
      return failure(error.message, 503)
    }
    console.error("Failed to load the saved calendar")
    return failure("Unable to load the saved calendar", 500)
  }
}

export async function POST(request: NextRequest) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return failure("Send the calendar as multipart form data", 400)
  }

  const file = form.get("file")
  if (!file || typeof file === "string") {
    return failure("Attach an .xlsx, .xls, or .csv calendar file", 400)
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return failure("That file is too large. The limit is 4 MB.", 413)
  }

  const fileName = file.name || "calendar"
  const isCsv = /\.csv$/i.test(fileName) || file.type === "text/csv"
  const isWorkbook = /\.(xlsx|xls)$/i.test(fileName)

  if (!isCsv && !isWorkbook) {
    return failure("Upload an .xlsx, .xls, or .csv calendar file", 400)
  }

  try {
    if (isCsv) {
      const parsed = parseContentCsv(await file.text())
      const dayCount = Object.keys(parsed.byDate).length
      if (dayCount === 0) {
        return failure("No dated rows found. Add a YYYY-MM-DD date to each CSV row.", 400)
      }

      const saved = await saveCalendar({ byDate: parsed.byDate }, fileName)
      return NextResponse.json({
        success: true,
        months: monthsFromDays(parsed.byDate),
        savedMonths: saved.savedMonths,
        skippedMonths: saved.skippedMonths,
        dayCount,
        ignoredRows: parsed.loose.length,
        importedAt: saved.importedAt,
        fileName,
      })
    }

    const parsed = parseContentWorkbook(await file.arrayBuffer())
    if (parsed.dayCount === 0) {
      return failure("No calendar data found in that workbook", 400)
    }

    const saved = await saveCalendar(parsed, fileName)
    return NextResponse.json({
      success: true,
      months: parsed.months,
      savedMonths: saved.savedMonths,
      skippedMonths: saved.skippedMonths,
      dayCount: parsed.dayCount,
      ignoredRows: 0,
      importedAt: saved.importedAt,
      fileName,
    })
  } catch (error) {
    if (error instanceof CalendarStorageUnavailable) {
      return failure(error.message, 503)
    }
    console.error("Failed to import the calendar")
    return failure("Couldn't import that calendar file", 500)
  }
}
