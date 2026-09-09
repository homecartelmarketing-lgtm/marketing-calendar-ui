# 🚀 24/7 Zero-Cost Backend Hosting Guide (Vercel + Cron-job.org)

This guide walks you through hosting the **HomeCartel Marketing Content Calendar & Auto-Posting System** completely free forever ($0.00/month) with 24/7 autonomous Instagram publishing.

---

## 🏗️ Architecture Summary

- **UI & Serverless Backend**: Hosted on **Vercel** (Free Hobby Tier).
- **Single Source of Truth**: **Airtable** stores all records, media attachments, and schedule timestamps.
- **24/7 Scheduling Runner**: **Cron-job.org** sends a lightweight HTTP ping every 1 minute to trigger `/api/schedules/runner`.
- **Publisher**: Publishes Stories, Reels, and Feeds directly to the **Meta Instagram Graph API (v19.0)** in Philippine Standard Time (UTC+08:00).

---

## 🛠️ Step 1: Push Code to GitHub

Make sure your latest code is committed and pushed to your GitHub repository:

```bash
git add .
git commit -m "Fix: Scheduler persistence & Airtable single source of truth"
git push origin main
```

---

## ⚡ Step 2: Deploy to Vercel (100% Free)

1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **Add New...** -> **Project**.
3. Select your `Marketing Output UI` repository and click **Import**.
4. Leave the Framework Preset as **Next.js**.

---

## 🔑 Step 3: Configure Environment Variables in Vercel

Before clicking Deploy, expand **Environment Variables** and add the following keys from your `.env.local`:

| Variable Name | Description | Example / Notes |
|---|---|---|
| `AIRTABLE_TOKEN` | Personal Access Token with read/write access | `pat...` |
| `AIRTABLE_BASE_ID` | Airtable Base ID | `appDM0jUDsaiThtR3` |
| `META_ACCESS_TOKEN` | Long-lived Meta Page Access Token | `EAA...` |
| `META_PAGE_ID` | Facebook Page ID | `1761624157420596` |
| `META_IG_ACCOUNT_ID` | Instagram Business Account ID | `17841404109072695` |
| `META_API_VERSION` | Graph API version | `v19.0` |
| `CRON_SECRET` | Secret token protecting the runner | Generate a secure random token (e.g. 32 chars) |

*(Optional: Add specific table ID overrides if custom tables are configured in `.env.local`)*

Click **Deploy**. In ~60 seconds, your site will be live at `https://<your-project-name>.vercel.app`!

---

## ⏰ Step 4: Configure 24/7 Auto-Posting with Cron-job.org

To publish scheduled posts automatically 24/7 even when your computer is off:

1. Go to [cron-job.org](https://cron-job.org) and create a free account.
2. In the dashboard, click **CREATE CRONJOB**.
3. Fill in the following details:
   - **Title**: `HomeCartel Instagram Auto-Poster`
   - **URL**:
     ```
     https://<YOUR-VERCEL-DOMAIN>.vercel.app/api/schedules/runner
     ```
   - **Schedule**: `Every 1 minute` (or `* * * * *`)
4. Under **Advanced / Headers**:
   - Add Header:
     - **Name**: `Authorization`
     - **Value**: `Bearer <YOUR_CRON_SECRET>`
     *(Alternatively, you can append `?secret=<YOUR_CRON_SECRET>` to the URL)*
5. Under **Notifications**:
   - Check **Notify on failure** so you receive an instant email if an Instagram post fails.
6. Click **Create Cronjob**.

---

## ✅ Step 5: Verification & Health Check

1. Open your live Vercel URL in your browser: `https://<YOUR-VERCEL-DOMAIN>.vercel.app`
2. Schedule a test post for 2 minutes from now.
3. Reload the page (F5) — confirm the post remains scheduled.
4. When the minute arrives, cron-job.org pings the runner, the post publishes to Instagram, and the status in Airtable automatically flips to **Posted**!
