# Troubleshooting: Meta Graph API Errors

#troubleshooting #meta-api #instagram #runbook

This guide details common error codes, diagnostic steps, and solutions when interacting with Meta Graph API for Instagram publishing.

---

## 🚨 Error Catalog

### 1. `OAuthException` / Code 190 (Token Expired or Invalidated)
* **Symptom**: `Error validating access token: The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons.`
* **Root Cause**: The long-lived Meta Page Access Token has expired (typically 60-day lifespan) or was invalidated due to Facebook profile password reset or permission changes.
* **Solution**:
  1. Open Meta Business Suite / Graph API Explorer.
  2. Generate a new System User or Page Access Token with required permissions:
     - `instagram_basic`
     - `instagram_content_publish`
     - `pages_read_engagement`
     - `pages_show_list`
  3. Exchange for a long-lived 60-day token.
  4. Update `META_ACCESS_TOKEN` in your Vercel Project Environment Settings (`Settings` -> `Environment Variables`) and `.env.local`.
  5. Redeploy or restart the Next.js instance.

### 2. Carousel Item Container Creation Failure (Code 36003 or 100)
* **Symptom**: `Media upload failed during child container creation` or carousel post fails with `Sub-items must be valid`.
* **Root Cause**:
  * One of the media URLs is unreachable (e.g. temporary Airtable CDN expiration or missing HTTPS).
  * Media format is not supported (Instagram requires JPEG/PNG with aspect ratios between 4:5 and 1.91:1).
* **Solution**:
  1. Verify the public URL of each attachment in a browser.
  2. If an attachment is from Airtable, note that modern Airtable attachment URLs expire after 2 hours if not freshly queried. Re-fetch candidate record before publishing.
  3. Check image dimensions and aspect ratios.

### 3. Video Container Not Ready (Code 2207001 or Polling Timeout)
* **Symptom**: `Media container status is still IN_PROGRESS after 5 attempts` during Reel publishing.
* **Root Cause**: Meta processes video files asynchronously. Large video files take longer to transcode before the publish step can be executed.
* **Solution**:
  1. Ensure the server polls `GET https://graph.facebook.com/v21.0/{container_id}?fields=status_code` with an exponential backoff (e.g., 2s, 4s, 8s).
  2. If status is `ERROR`, inspect `status` field for detailed video encoding failures.

### 4. Meta Succeeded, but Airtable Status Sync Failed (`statusSyncWarning`)
* **Symptom**: The post appears live on Instagram, but the UI alerts with a `statusSyncWarning` and Airtable still shows `Scheduled`.
* **Root Cause**: Airtable API encountered a 429 rate limit or network glitch immediately after the Meta publish call succeeded.
* **Solution**:
  * **DO NOT** click "Post Now" or trigger runner again! Doing so will create duplicate posts on Instagram.
  * Manually update the Airtable row status to `Posted` (or run a status-only PATCH).
  * The system records the `meta_post_id` in Postgres `automation_runs`, preventing duplicate executions.

---

## 🔗 Related Notes
- [[architecture/system-blueprint|System Blueprint]]
- [[troubleshooting/durable-queue-and-cron|Troubleshooting Durable Queue & Cron]]
