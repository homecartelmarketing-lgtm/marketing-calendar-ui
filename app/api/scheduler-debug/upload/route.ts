import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: "No image file provided" }, { status: 400 })
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = path.extname(file.name) || ".jpg"
    const safeBase = file.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30)
    const filename = `test_${Date.now()}_${safeBase}${ext}`
    const filePath = path.join(uploadsDir, filename)

    fs.writeFileSync(filePath, buffer)

    // Check if Cloudflare tunnel is running
    let baseUrl = request.nextUrl.origin
    const cfFilePath = path.join(process.cwd(), ".cloudflare_url.txt")
    if (fs.existsSync(cfFilePath)) {
      const cfUrl = fs.readFileSync(cfFilePath, "utf8").trim()
      if (cfUrl.startsWith("http")) {
        baseUrl = cfUrl
      }
    }

    const relativeUrl = `/uploads/${filename}`
    const fullUrl = `${baseUrl}${relativeUrl}`

    return NextResponse.json({
      success: true,
      filename,
      relativeUrl,
      fullUrl,
      isLocalhost: baseUrl.includes("localhost"),
    })
  } catch (error: any) {
    console.error("Upload handler error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save uploaded file" },
      { status: 500 }
    )
  }
}
