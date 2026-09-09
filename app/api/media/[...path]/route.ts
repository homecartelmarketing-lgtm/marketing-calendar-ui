import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const MARKETING_AUTOMATION_DIR =
  process.env.MARKETING_AUTOMATION_DIR || "C:\\Users\\User\\marketing-automation"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params
    const relativePath = resolvedParams.path.join("/")
    const fullPath = path.join(MARKETING_AUTOMATION_DIR, "output", relativePath)

    // Security check: ensure path is within output dir
    const outputDir = path.join(MARKETING_AUTOMATION_DIR, "output")
    if (!fullPath.startsWith(outputDir) || !fs.existsSync(fullPath)) {
      return new NextResponse("Not Found", { status: 404 })
    }

    const fileBuffer = fs.readFileSync(fullPath)
    const ext = path.extname(fullPath).toLowerCase()

    let contentType = "application/octet-stream"
    if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg"
    else if (ext === ".png") contentType = "image/png"
    else if (ext === ".webp") contentType = "image/webp"
    else if (ext === ".mp4") contentType = "video/mp4"

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (error) {
    return new NextResponse("Error reading file", { status: 500 })
  }
}
