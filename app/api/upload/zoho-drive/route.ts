import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, autoEnv } from "@/lib/tables-config"

export const dynamic = "force-dynamic"

const PARENT_FOLDERS: Record<string, string> = {
  "Chandelier": "1jvesa9d41b8a1b104bebb415529d57e05d45",
  "Table lamps": "h9prx224a7ad812fa48939e3033c482810c5a",
  "Table Lamp": "h9prx224a7ad812fa48939e3033c482810c5a",
  "Rechargeable Table Lamps": "h9prxfb49d8ee279b4a03b879d90a48150b53",
  "Floor Lamps": "fgthe556ddf3375b0447d8eadb15ac058a049",
  "Floor Lamp": "fgthe556ddf3375b0447d8eadb15ac058a049",
  "Pendant Lights": "fgtheace4be50836a4027917ba13667d771d5",
  "Pendant Light": "fgtheace4be50836a4027917ba13667d771d5",
  "Cluster Chandelier": "h9prx0690a1f30ad14ad2b0cb2c5f68dd6972",
  "Ceiling Lights": "h9prx5db1574946b34468bfcc329c599b0c83",
  "Wall lights": "h9prx235361b3752a4ae3af700a4b0fc6ce7e",
  "Wall Light": "h9prx235361b3752a4ae3af700a4b0fc6ce7e",
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const recordId = (formData.get("recordId") as string | null) || ""
    const tableId = (formData.get("tableId") as string | null) || ""
    const fixtureType = (formData.get("fixtureType") as string | null) || "Chandelier"
    const notes = (formData.get("notes") as string | null) || ""
    const imageKind = (formData.get("imageKind") as string | null) || "Day" // "Day" or "Night"

    if (!file) {
      return NextResponse.json({ status: "error", message: "No file provided" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

    // 1. Save locally in public/uploads for instant UI preview
    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    const localFilePath = path.join(uploadsDir, filename)
    fs.writeFileSync(localFilePath, buffer)
    const localFileUrl = `/uploads/${filename}`

    let zohoUploaded = false
    let zohoFileId: string | null = null
    let zohoError: string | null = null

    // 2. Check for Zoho WorkDrive OAuth credentials
    const zohoClientId = process.env.ZOHO_CLIENT_ID || autoEnv.ZOHO_CLIENT_ID
    const zohoClientSecret = process.env.ZOHO_CLIENT_SECRET || autoEnv.ZOHO_CLIENT_SECRET
    const zohoRefreshToken = process.env.ZOHO_REFRESH_TOKEN || autoEnv.ZOHO_REFRESH_TOKEN

    if (zohoClientId && zohoClientSecret && zohoRefreshToken) {
      try {
        // Refresh token
        const tokenRes = await fetch("https://accounts.zoho.com/oauth/v2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: zohoClientId,
            client_secret: zohoClientSecret,
            refresh_token: zohoRefreshToken,
            grant_type: "refresh_token",
          }),
        })

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json()
          const accessToken = tokenData.access_token

          if (accessToken) {
            const parentId =
              PARENT_FOLDERS[fixtureType] ||
              PARENT_FOLDERS["Chandelier"] ||
              "1jvesa9d41b8a1b104bebb415529d57e05d45"

            const zohoUploadForm = new FormData()
            const blob = new Blob([buffer], { type: file.type || "image/jpeg" })
            zohoUploadForm.append("content", blob, file.name)
            zohoUploadForm.append("parent_id", parentId)

            const uploadRes = await fetch("https://workdrive.zoho.com/api/v1/upload", {
              method: "POST",
              headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`,
                Accept: "application/vnd.api+json",
              },
              body: zohoUploadForm,
            })

            if (uploadRes.ok) {
              const uploadData = await uploadRes.json()
              zohoUploaded = true
              zohoFileId = uploadData?.data?.[0]?.attributes?.resource_id || uploadData?.data?.id || null
            } else {
              zohoError = `Zoho WorkDrive returned HTTP ${uploadRes.status}: ${await uploadRes.text()}`
              console.warn("Zoho WorkDrive upload failed:", zohoError)
            }
          }
        } else {
          zohoError = `Zoho token refresh returned HTTP ${tokenRes.status}`
        }
      } catch (err: any) {
        zohoError = err?.message || String(err)
        console.warn("Zoho WorkDrive upload error:", err)
      }
    }

    // 3. Update Airtable status to "For Manual"
    if (recordId && tableId && tableId.startsWith("tbl")) {
      try {
        const patchBody: Record<string, any> = {
          Status: "For Manual",
        }

        const patchRes = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${AIRTABLE_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ fields: patchBody }),
          }
        )

        if (!patchRes.ok) {
          console.warn("Failed to patch Airtable status to For Manual:", await patchRes.text())
        }
      } catch (patchErr) {
        console.warn("Airtable patch error during manual upload:", patchErr)
      }
    }

    return NextResponse.json({
      status: "success",
      message: zohoUploaded
        ? "File successfully uploaded to Zoho WorkDrive and status set to For Manual"
        : "File uploaded locally for manual review and status set to For Manual",
      zohoUploaded,
      zohoFileId,
      zohoError,
      fileUrl: localFileUrl,
      fileName: file.name,
      imageKind,
      recordId,
    })
  } catch (error: any) {
    console.error("Upload handler error:", error)
    return NextResponse.json(
      { status: "error", message: error?.message || "Upload failed" },
      { status: 500 }
    )
  }
}
