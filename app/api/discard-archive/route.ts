import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, autoEnv, MARKETING_AUTOMATION_DIR } from "@/lib/tables-config"

export const dynamic = "force-dynamic"
export const maxDuration = 60 // Allow up to 60s for downloading and uploading multiple media files

interface DiscardArchiveRequestBody {
  recordId: string
  tableId: string
  idea?: string
  itemName?: string
  mediaUrls?: string[]
}

const DEFAULT_DISCARD_FOLDER_ID = "0637uf343c5630cfa4480b418155d5dbc9d31"

async function getZohoAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const tokenRes = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`Zoho token refresh failed (HTTP ${tokenRes.status}): ${errText}`)
  }

  const tokenData = await tokenRes.json()
  if (tokenData.error) {
    throw new Error(`Zoho OAuth error: ${tokenData.error} (${tokenData.error_description || "Please check your Zoho credentials in Vercel"})`)
  }
  if (!tokenData.access_token) {
    throw new Error(`Zoho token response did not contain access_token: ${JSON.stringify(tokenData)}`)
  }

  return tokenData.access_token
}

async function getOrCreateZohoFolder(folderName: string, parentId: string, accessToken: string): Promise<string> {
  // 1. Try to create folder
  try {
    const createRes = await fetch("https://workdrive.zoho.com/api/v1/files", {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        Accept: "application/vnd.api+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            name: folderName,
            parent_id: parentId,
          },
          type: "files",
        },
      }),
    })

    if (createRes.ok) {
      const createData = await createRes.json()
      const newId = createData?.data?.id
      if (newId) return newId
    }
  } catch (createErr) {
    console.warn(`Folder create attempt for '${folderName}' failed, will check if exists:`, createErr)
  }

  // 2. If creation fails (e.g. folder already exists), search parent's folder list
  const listRes = await fetch(`https://workdrive.zoho.com/api/v1/files/${parentId}/files?page[limit]=50`, {
    method: "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      Accept: "application/vnd.api+json",
    },
  })

  if (!listRes.ok) {
    const listErr = await listRes.text()
    throw new Error(`Could not list files in parent '${parentId}': ${listErr}`)
  }

  const listData = await listRes.json()
  const items = listData?.data || []
  for (const item of items) {
    const attrs = item?.attributes || {}
    if (attrs.name === folderName && (attrs.is_folder || attrs.type === "folder")) {
      return item.id
    }
  }

  throw new Error(`Folder '${folderName}' could not be created or found in parent '${parentId}'`)
}

async function fetchMediaBuffer(mediaUrl: string, reqOrigin: string): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
  // Handle local disk if relative URL
  if (mediaUrl.startsWith("/api/media/")) {
    const relativePath = mediaUrl.replace(/^\/api\/media\//, "")
    const fullPath = path.join(MARKETING_AUTOMATION_DIR, "output", relativePath)
    if (fs.existsSync(fullPath)) {
      const buffer = fs.readFileSync(fullPath)
      const fileName = path.basename(fullPath)
      const ext = path.extname(fullPath).toLowerCase()
      let contentType = "image/jpeg"
      if (ext === ".png") contentType = "image/png"
      else if (ext === ".webp") contentType = "image/webp"
      else if (ext === ".mp4") contentType = "video/mp4"
      return { buffer, fileName, contentType }
    }
  } else if (mediaUrl.startsWith("/uploads/")) {
    const relativePath = mediaUrl.replace(/^\/uploads\//, "")
    const fullPath = path.join(process.cwd(), "public", "uploads", relativePath)
    if (fs.existsSync(fullPath)) {
      const buffer = fs.readFileSync(fullPath)
      const fileName = path.basename(fullPath)
      return { buffer, fileName, contentType: "image/jpeg" }
    }
  }

  // Absolute URL or external fetch
  const targetUrl = mediaUrl.startsWith("http") ? mediaUrl : `${reqOrigin}${mediaUrl}`
  const res = await fetch(targetUrl)
  if (!res.ok) {
    throw new Error(`Failed to fetch media from ${targetUrl}: HTTP ${res.status}`)
  }

  const arrayBuf = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)
  const contentType = res.headers.get("content-type") || "image/jpeg"

  // Derive file name
  let fileName = "discarded_asset.jpg"
  try {
    const urlObj = new URL(targetUrl)
    const base = path.basename(urlObj.pathname)
    if (base && base.includes(".")) {
      fileName = base
    } else {
      const ext = contentType.includes("png") ? ".png" : contentType.includes("mp4") ? ".mp4" : ".jpg"
      fileName = `slide_${Date.now()}${ext}`
    }
  } catch {
    fileName = `slide_${Date.now()}.jpg`
  }

  return { buffer, fileName, contentType }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DiscardArchiveRequestBody
    const { recordId, tableId, idea = "Content", itemName = "", mediaUrls = [] } = body

    if (!recordId) {
      return NextResponse.json({ status: "error", message: "recordId is required" }, { status: 400 })
    }

    let zohoArchived = false
    let zohoFolderId: string | null = null
    let zohoWarning: string | null = null
    let uploadedCount = 0

    // 1. Check for Zoho WorkDrive credentials
    const zohoClientId = process.env.ZOHO_CLIENT_ID || autoEnv.ZOHO_CLIENT_ID
    const zohoClientSecret = process.env.ZOHO_CLIENT_SECRET || autoEnv.ZOHO_CLIENT_SECRET
    const zohoRefreshToken = process.env.ZOHO_REFRESH_TOKEN || autoEnv.ZOHO_REFRESH_TOKEN
    const masterFolderId = process.env.ZOHO_DISCARD_FOLDER_ID || autoEnv.ZOHO_DISCARD_FOLDER_ID || DEFAULT_DISCARD_FOLDER_ID

    if (zohoClientId && zohoClientSecret && zohoRefreshToken) {
      try {
        const accessToken = await getZohoAccessToken(zohoClientId, zohoClientSecret, zohoRefreshToken)

        // Form date folder: YYYY-MM-DD
        const today = new Date().toISOString().split("T")[0]
        const dateFolderId = await getOrCreateZohoFolder(today, masterFolderId, accessToken)

        // Form item folder name: [Idea] - [ItemName]
        const cleanIdea = idea.replace(/[\/\\:*?"<>|]/g, " ").trim()
        const cleanName = itemName.replace(/[\/\\:*?"<>|]/g, " ").trim()
        const folderTitle = `${cleanIdea}${cleanName ? ` - ${cleanName}` : ""}`.slice(0, 75) || `Discarded ${recordId}`

        const itemFolderId = await getOrCreateZohoFolder(folderTitle, dateFolderId, accessToken)
        zohoFolderId = itemFolderId

        // Upload media items
        const reqOrigin = request.nextUrl.origin
        for (let i = 0; i < mediaUrls.length; i++) {
          const mUrl = mediaUrls[i]
          if (!mUrl) continue

          try {
            const { buffer, fileName, contentType } = await fetchMediaBuffer(mUrl, reqOrigin)
            const uploadForm = new FormData()
            const blob = new Blob([buffer], { type: contentType })
            const uploadName = `slide_${i + 1}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`

            uploadForm.append("content", blob, uploadName)
            uploadForm.append("parent_id", itemFolderId)

            const uploadRes = await fetch(`https://workdrive.zoho.com/api/v1/upload?parent_id=${itemFolderId}&override-name-exist=true`, {
              method: "POST",
              headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`,
                Accept: "application/vnd.api+json",
              },
              body: uploadForm,
            })

            if (uploadRes.ok) {
              uploadedCount++
            } else {
              console.warn(`Zoho upload failed for media ${i + 1}:`, await uploadRes.text())
            }
          } catch (fileErr) {
            console.warn(`Error processing media file ${mUrl}:`, fileErr)
          }
        }

        zohoArchived = true
      } catch (zohoErr: any) {
        console.error("Zoho WorkDrive archive error:", zohoErr)
        zohoWarning = zohoErr?.message || "Zoho upload failed"
      }
    } else {
      zohoWarning = "Zoho credentials (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN) are not configured in environment."
      console.warn("Zoho Archive Warning:", zohoWarning)
    }

    // 2. Update Airtable record Status to "Discard"
    let airtableUpdated = false
    let airtableError: string | null = null

    if (tableId && tableId.startsWith("tbl")) {
      try {
        const patchRes = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${AIRTABLE_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fields: {
                Status: "Discard",
              },
            }),
          }
        )

        if (patchRes.ok) {
          airtableUpdated = true
        } else {
          // Fallback: try "Discarded" if table schema uses "Discarded"
          const patchFallbackRes = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}/${recordId}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${AIRTABLE_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                fields: {
                  Status: "Discarded",
                },
              }),
            }
          )
          if (patchFallbackRes.ok) {
            airtableUpdated = true
          } else {
            airtableError = await patchRes.text()
            console.warn(`Failed to patch Airtable status to Discard: ${airtableError}`)
          }
        }
      } catch (err: any) {
        airtableError = err?.message || String(err)
        console.error("Airtable patch exception:", err)
      }
    }

    return NextResponse.json({
      status: "success",
      airtableUpdated,
      airtableError,
      zohoArchived,
      zohoFolderId,
      uploadedCount,
      zohoWarning,
      folderUrl: zohoFolderId
        ? `https://workdrive.zoho.com/2oefff5bd4f48dac04716ac9cacd1b9ab6083/teams/2oefff5bd4f48dac04716ac9cacd1b9ab6083/ws/uh2ugba7e4e32e0284ec994d17238575e9402/folders/${zohoFolderId}`
        : null,
      message: zohoArchived
        ? `Archived ${uploadedCount} asset(s) to Zoho WorkDrive and marked as Discard.`
        : `Airtable status marked as Discard. Note: ${zohoWarning || "Zoho archive skipped."}`,
    })
  } catch (error: any) {
    console.error("Discard archive handler error:", error)
    return NextResponse.json(
      { status: "error", message: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
