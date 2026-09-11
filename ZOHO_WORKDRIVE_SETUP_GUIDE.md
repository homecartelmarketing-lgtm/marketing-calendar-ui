# Zoho WorkDrive Integration & OAuth Setup Guide

This guide walks you through generating your **Zoho WorkDrive Client ID, Client Secret, and Refresh Token** so the Marketing Output UI can automatically archive discarded marketing deliverables into your dedicated Zoho WorkDrive folder.

---

## 🎯 Target Zoho Folder
Your discard archive folder is:
```
https://workdrive.zoho.com/2oefff5bd4f48dac04716ac9cacd1b9ab6083/teams/2oefff5bd4f48dac04716ac9cacd1b9ab6083/ws/uh2ugba7e4e32e0284ec994d17238575e9402/folders/0637uf343c5630cfa4480b418155d5dbc9d31
```
* **Folder ID**: `0637uf343c5630cfa4480b418155d5dbc9d31`

---

## 🔑 Step 1: Open Zoho API Console
1. Go to [https://api-console.zoho.com/](https://api-console.zoho.com/) and log in with your Zoho account.
2. Click **Add Client** (or **Get Started** if this is your first application).
3. Select **Self Client** from the client types and click **Create**.

---

## 📋 Step 2: Obtain Client ID & Client Secret
1. Once created, click on the client you just created.
2. Under the **Client Details** tab, copy:
   * **Client ID** (e.g. `1000.XXXXXXXXXX`)
   * **Client Secret** (e.g. `xxxxxxxxxxxxxxxxxxxx`)

---

## 🔄 Step 3: Generate the Grant Code
1. In the same client details page, switch to the **Generate Code** tab.
2. In the **Scope** field, enter:
   ```text
   WorkDrive.files.ALL,WorkDrive.workspace.ALL
   ```
3. Set **Time Duration** to **10 minutes** (maximum allowed).
4. Enter any description (e.g. `Marketing Output Discard Archive`).
5. Click **CREATE**.
6. A popup will show your **Generated Code** (starts with `1000....`). Copy this immediately (it is valid for a few minutes).

---

## 🎟️ Step 4: Exchange the Code for a Permanent Refresh Token
Open your terminal (PowerShell or Bash) and run the following `curl` command (replace the placeholders with your actual values):

### In PowerShell:
```powershell
$params = @{
    client_id     = "YOUR_CLIENT_ID"
    client_secret = "YOUR_CLIENT_SECRET"
    grant_type    = "authorization_code"
    code          = "YOUR_GENERATED_CODE_FROM_STEP_3"
}
Invoke-RestMethod -Uri "https://accounts.zoho.com/oauth/v2/token" -Method Post -Body $params
```

### In Bash / Command Prompt with curl:
```bash
curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_GENERATED_CODE_FROM_STEP_3"
```

### Expected Response:
```json
{
  "access_token": "1000.xxxxxxxx",
  "refresh_token": "1000.yyyyyyyyyyyyyyyyyyyyy",
  "api_domain": "https://www.zohoapis.com",
  "token_type": "Bearer",
  "expires_in": 3600
}
```
Copy the **`refresh_token`**. Unlike access tokens, the **refresh token does not expire** and allows the application to upload files automatically.

---

## ⚙️ Step 5: Add Keys to `.env.local`
In the `Marketing Output UI` directory, open `.env.local` (or add to your Vercel Project Settings under Environment Variables):

```env
ZOHO_CLIENT_ID=1000.XXXXXXXXXXXX
ZOHO_CLIENT_SECRET=XXXXXXXXXXXXXXXXXXXX
ZOHO_REFRESH_TOKEN=1000.YYYYYYYYYYYY
ZOHO_DISCARD_FOLDER_ID=0637uf343c5630cfa4480b418155d5dbc9d31
```

---

## 🚀 How it Works in Marketing Output UI
1. When you click **Discard** on any item in the calendar or preview modal, a confirmation popup appears.
2. Clicking **CONFIRM & ARCHIVE TO ZOHO**:
   * Auto-refreshes the Zoho access token.
   * Creates or locates the date folder (`YYYY-MM-DD`, e.g. `2026-09-11`) under your master Discard folder.
   * Creates an item folder (e.g. `Myth & Fact - Nordic Chandelier`).
   * Downloads and uploads all generated slides and media directly into that folder.
   * Updates Airtable status to `"Discard"`.
3. If Zoho credentials are not provided or an error occurs, the UI updates Airtable to "Discard" anyway and displays a notice.
