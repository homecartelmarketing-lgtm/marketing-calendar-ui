# 🚀 HomeCartel Marketing Calendar - Zoho Catalyst AppSail Deployment Guide

This guide walks you through deploying the **Next.js Marketing Content Calendar & Meta Instagram Auto-Posting** application to **Zoho Catalyst AppSail** so it runs 24/7 in the cloud with its own permanent URL.

---

## 📌 How It Works on Zoho Catalyst

1. **AppSail (Container Service)**: Runs the Next.js production server inside a lightweight Docker container.
2. **Dedicated Cloud URL**: Zoho Catalyst assigns a live URL, for example:
   `https://homecartel-marketing-calendar-XXXXX.catalystserverless.com`
3. **Catalyst Cron (24/7 Auto-Posting)**: Automatically pings `/api/schedules/runner` every minute in Philippine Standard Time (`Asia/Manila`, UTC+08:00) so scheduled Stories, Reels, and Feeds are published to Instagram even when all computers are off.

---

## 🛠️ Step 1: Install Zoho Catalyst CLI

Open PowerShell or Terminal and install the official Zoho Catalyst CLI:

```powershell
npm install -g zcatalyst-cli
```

Verify the installation:
```powershell
catalyst --version
```

---

## 🔑 Step 2: Login to Your Zoho Account

Run the login command:
```powershell
catalyst login
```
*This will open your default browser to authenticate your Zoho Catalyst account. Confirm the login in your browser.*

---

## 📦 Step 3: Initialize the Project

Inside the `Marketing Output UI` directory (`c:\Users\User\Downloads\Marketing Output UI`):

```powershell
catalyst init
```

During the interactive prompts:
1. **Select Project**: Choose your existing Catalyst Project (e.g., `HomeCartel Automation`) or create a **New Project** named `homecartel-marketing-calendar`.
2. **Select Features**: Choose **AppSail**.
3. It will detect the existing `catalyst.json` and `Dockerfile` automatically.

---

## 🚀 Step 4: Deploy to Zoho Catalyst

Deploy your AppSail container to the cloud:

```powershell
catalyst deploy
```

Catalyst will:
- Package your files (guided by `.dockerignore`)
- Build the Next.js Docker image
- Start the container on AppSail
- Output your **live AppSail URL** in the terminal!

---

## ⚙️ Step 5: Configure Environment Variables

1. Open the [Zoho Catalyst Console](https://catalyst.zoho.com/).
2. Select your project -> **AppSail** -> **`homecartel-marketing-calendar`**.
3. Click the **Configuration** tab -> **Environment Variables**.
4. Click **Add Variable** and input the following values from `.env.local`:

| Variable Name | Value | Purpose |
|---|---|---|
| `AIRTABLE_TOKEN` | `pat6TrWWL12...` | Airtable API access |
| `AIRTABLE_BASE_ID` | `appDM0jUDsaiThtR3` | Home Cartel base ID |
| `META_ACCESS_TOKEN` | `EAGJnxFYVdH...` | Meta Page Access Token |
| `META_PAGE_ID` | `1761624157420596` | Home Cartel FB Page ID |
| `META_IG_ACCOUNT_ID` | `17841404109072695` | Instagram Business Account ID |
| `META_API_VERSION` | `v19.0` | Meta Graph API version |
| `CRON_SECRET` | `hc_cron_2026_marketing_secret` | Secret key protecting the runner |

*Click **Save** and **Redeploy** to apply the environment variables.*

---

## ⏰ Step 6: Configure 24/7 Auto-Posting with Catalyst Cron

To ensure Instagram posts go live at their scheduled times 24/7:

1. In the Catalyst Console left sidebar, click **Cron**.
2. Click **Create Cron**.
3. Configure the Cron:
   - **Name**: `instagram-auto-post-runner`
   - **Type**: **URL** (or HTTP Trigger)
   - **Cron Expression**: `* * * * *` (Runs every 1 minute)
   - **Timezone**: `Asia/Manila (GMT+8:00)`
   - **HTTP Method**: `GET`
   - **URL**:
     ```
     https://<YOUR-CATALYST-APPSAIL-URL>/api/schedules/runner?secret=hc_cron_2026_marketing_secret
     ```
4. Click **Save**.

---

## 🌐 Where to Find Your Live Hosted URL

In the [Zoho Catalyst Console](https://catalyst.zoho.com/):
1. Navigate to **AppSail**.
2. Click on **`homecartel-marketing-calendar`**.
3. Under the service header, you will see your **Live URL**:
   `https://homecartel-marketing-calendar-XXXXX.catalystserverless.com`
4. Click the link to open your live Content Calendar in your browser!
