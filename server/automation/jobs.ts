import { createHash, randomUUID } from "crypto"
import {
  AutomationJobRow,
  executeSql,
  getMockDb,
  isMockDb,
} from "@/server/db/client"
import { ScheduleValidationError, normalizePhtTime } from "@/server/airtable/write-schedule"

export interface CreateJobInput {
  recordId: string
  tableId: string
  category: "Stories" | "Feeds" | "Reels"
  idea?: string
  fixture?: string
  foreignKeyId?: string
  isoDate: string
  time: string | null
  caption: string
  mediaType: "image" | "video" | "carousel"
  mediaUrl: string
  mediaUrls?: string[]
  referenceNow?: Date
}

export function validateFuturePhtSchedule(
  isoDate?: string,
  time?: string | null,
  referenceNow: Date = new Date()
): { scheduledTime: Date; scheduledIso: string; timePht: string } {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new ScheduleValidationError("A valid scheduled date (YYYY-MM-DD) is required")
  }
  const effectiveTime = normalizePhtTime(time)
  if (!effectiveTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(effectiveTime)) {
    throw new ScheduleValidationError("A valid scheduled time (HH:mm in PHT) is required")
  }

  // Parse as Philippine Time (UTC+08:00)
  const scheduledTime = new Date(`${isoDate}T${effectiveTime}:00+08:00`)
  if (!Number.isFinite(scheduledTime.getTime())) {
    throw new ScheduleValidationError("The scheduled calendar date and time do not exist")
  }

  if (scheduledTime.getTime() <= referenceNow.getTime()) {
    throw new ScheduleValidationError(
      "Scheduled time must be in the future (PHT). For immediate publishing, use 'Post Now'."
    )
  }

  return { scheduledTime, scheduledIso: isoDate, timePht: effectiveTime }
}

export function computeMediaVersion(media: {
  mediaType: string
  mediaUrl: string
  mediaUrls?: string[]
  caption?: string
}): string {
  const content = [
    media.mediaType,
    media.mediaUrl,
    ...(media.mediaUrls || []),
    media.caption || "",
  ].join("::")
  return createHash("sha256").update(content).digest("hex").slice(0, 16)
}

export function deriveIdempotencyKey(
  recordId: string,
  scheduledTime: Date,
  mediaVersion: string
): string {
  return `${recordId}:${scheduledTime.toISOString()}:${mediaVersion}`
}

export async function createOrReplaceScheduledJob(
  input: CreateJobInput
): Promise<AutomationJobRow> {
  const {
    recordId,
    tableId,
    category,
    idea,
    fixture,
    foreignKeyId,
    isoDate,
    time,
    caption,
    mediaType,
    mediaUrl,
    mediaUrls = [],
    referenceNow,
  } = input

  if (!recordId || !/^rec[a-zA-Z0-9]+$/.test(recordId)) {
    throw new ScheduleValidationError("A valid Airtable recordId is required")
  }
  if (!tableId || !/^tbl[a-zA-Z0-9]+$/.test(tableId)) {
    throw new ScheduleValidationError("A valid Airtable tableId is required")
  }
  if (!mediaUrl && (!mediaUrls || mediaUrls.length === 0)) {
    throw new ScheduleValidationError("Media URL or slides are required to schedule a post")
  }

  const effectiveMediaUrl = mediaUrl || mediaUrls[0]
  const effectiveMediaUrls = mediaUrls.length > 0 ? mediaUrls : [effectiveMediaUrl]

  const { scheduledTime, scheduledIso, timePht } = validateFuturePhtSchedule(
    isoDate,
    time,
    referenceNow
  )

  const mediaVersion = computeMediaVersion({
    mediaType,
    mediaUrl: effectiveMediaUrl,
    mediaUrls: effectiveMediaUrls,
    caption,
  })

  const idempotencyKey = deriveIdempotencyKey(recordId, scheduledTime, mediaVersion)
  const jobId = `job_${randomUUID().replace(/-/g, "").slice(0, 16)}`
  const now = referenceNow || new Date()

  const newJob: AutomationJobRow = {
    id: jobId,
    idempotency_key: idempotencyKey,
    record_id: recordId,
    table_id: tableId,
    category,
    idea: idea || null,
    fixture: fixture || null,
    foreign_key_id: foreignKeyId || null,
    scheduled_time: scheduledTime,
    scheduled_iso: scheduledIso,
    time_pht: timePht,
    caption,
    media_type: mediaType,
    media_url: effectiveMediaUrl,
    media_urls: effectiveMediaUrls,
    media_version: mediaVersion,
    status: "Scheduled",
    attempts: 0,
    max_attempts: 3,
    next_attempt_at: null,
    lease_owner: null,
    lease_expires_at: null,
    meta_publication_ids: [],
    last_error_code: null,
    last_error_message: null,
    created_at: now,
    updated_at: now,
  }

  if (isMockDb()) {
    const mockDb = getMockDb()
    // Cancel any existing active job for this record (reschedule cancels previous job version)
    const existing = mockDb.findActiveJobByRecordId(recordId)
    if (existing && existing.status !== "Publishing") {
      mockDb.updateJob(existing.id, { status: "Cancelled" })
    }
    return mockDb.insertJob(newJob)
  }

  // Neon Postgres implementation
  // 1. Cancel previous active jobs for this record
  await executeSql(
    `UPDATE automation_jobs 
     SET status = 'Cancelled', updated_at = NOW() 
     WHERE record_id = $1 AND status IN ('Scheduled', 'Retry Pending')`,
    [recordId]
  )

  // 2. Insert new job
  const rows = await executeSql<AutomationJobRow>(
    `INSERT INTO automation_jobs (
      id, idempotency_key, record_id, table_id, category, idea, fixture,
      foreign_key_id, scheduled_time, scheduled_iso, time_pht, caption,
      media_type, media_url, media_urls, media_version, status,
      attempts, max_attempts, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, $14, $15, $16, 'Scheduled',
      0, 3, $17, $17
    )
    ON CONFLICT (idempotency_key) DO UPDATE
    SET status = 'Scheduled', updated_at = NOW()
    RETURNING *`,
    [
      newJob.id,
      newJob.idempotency_key,
      newJob.record_id,
      newJob.table_id,
      newJob.category,
      newJob.idea,
      newJob.fixture,
      newJob.foreign_key_id,
      newJob.scheduled_time,
      newJob.scheduled_iso,
      newJob.time_pht,
      newJob.caption,
      newJob.media_type,
      newJob.media_url,
      JSON.stringify(newJob.media_urls),
      newJob.media_version,
      now,
    ]
  )

  return rows[0] || newJob
}

export async function claimDueJobs(options?: {
  now?: Date
  limit?: number
  leaseMinutes?: number
  runnerId?: string
}): Promise<AutomationJobRow[]> {
  const now = options?.now || new Date()
  const limit = options?.limit || 10
  const leaseMinutes = options?.leaseMinutes || 5
  const runnerId = options?.runnerId || `runner_${process.pid || 1}_${Date.now()}`

  if (isMockDb()) {
    return getMockDb().claimDueJobs(now, limit, leaseMinutes, runnerId)
  }

  const leaseExpiry = new Date(now.getTime() + leaseMinutes * 60 * 1000)

  // Atomic claim using FOR UPDATE SKIP LOCKED
  const query = `
    UPDATE automation_jobs
    SET status = 'Publishing',
        lease_owner = $1,
        lease_expires_at = $2,
        updated_at = NOW()
    WHERE id IN (
      SELECT id FROM automation_jobs
      WHERE (status = 'Scheduled' OR status = 'Retry Pending')
        AND (
          (status = 'Scheduled' AND scheduled_time <= $3)
          OR (status = 'Retry Pending' AND next_attempt_at <= $3)
        )
        AND (lease_expires_at IS NULL OR lease_expires_at < $3)
      ORDER BY scheduled_time ASC
      LIMIT $4
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
  `

  return executeSql<AutomationJobRow>(query, [runnerId, leaseExpiry, now, limit])
}

export async function recordJobSuccess(
  jobId: string,
  metaPublicationIds: string[]
): Promise<void> {
  const now = new Date()
  if (isMockDb()) {
    const mockDb = getMockDb()
    mockDb.updateJob(jobId, {
      status: "Posted",
      meta_publication_ids: metaPublicationIds,
      lease_owner: null,
      lease_expires_at: null,
      last_error_code: null,
      last_error_message: null,
    })
    mockDb.insertRun({
      job_id: jobId,
      trigger: "vercel-cron",
      attempt: 1,
      started_at: now,
      finished_at: now,
      status: "Posted",
      meta_publication_ids: metaPublicationIds,
    })
    return
  }

  await executeSql(
    `UPDATE automation_jobs
     SET status = 'Posted',
         meta_publication_ids = $1,
         lease_owner = NULL,
         lease_expires_at = NULL,
         last_error_code = NULL,
         last_error_message = NULL,
         updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(metaPublicationIds), jobId]
  )

  await executeSql(
    `INSERT INTO automation_runs (job_id, trigger, attempt, started_at, finished_at, status, meta_publication_ids)
     VALUES ($1, 'vercel-cron', 1, $2, $2, 'Posted', $3)`,
    [jobId, now, JSON.stringify(metaPublicationIds)]
  )
}

export async function recordJobFailure(
  jobId: string,
  error: { code?: string; message: string; isPermanent?: boolean }
): Promise<{ nextStatus: string; retryInMinutes?: number }> {
  const now = new Date()

  // Retrieve current job to check attempts
  let currentJob: AutomationJobRow | null = null
  if (isMockDb()) {
    currentJob = getMockDb().getJob(jobId)
  } else {
    const rows = await executeSql<AutomationJobRow>(
      `SELECT * FROM automation_jobs WHERE id = $1`,
      [jobId]
    )
    currentJob = rows[0] || null
  }

  const nextAttempt = (currentJob?.attempts || 0) + 1
  const maxAttempts = currentJob?.max_attempts || 3

  let nextStatus: "Retry Pending" | "For Manual" = "Retry Pending"
  let retryInMinutes: number | undefined = undefined

  if (error.isPermanent || nextAttempt >= maxAttempts) {
    nextStatus = "For Manual"
  } else {
    // 1, 5, 15 minutes retry progression
    if (nextAttempt === 1) retryInMinutes = 1
    else if (nextAttempt === 2) retryInMinutes = 5
    else retryInMinutes = 15
  }

  const nextAttemptAt = retryInMinutes
    ? new Date(now.getTime() + retryInMinutes * 60 * 1000)
    : null

  if (isMockDb()) {
    const mockDb = getMockDb()
    mockDb.updateJob(jobId, {
      status: nextStatus,
      attempts: nextAttempt,
      next_attempt_at: nextAttemptAt,
      lease_owner: null,
      lease_expires_at: null,
      last_error_code: error.code || null,
      last_error_message: error.message,
    })
    mockDb.insertRun({
      job_id: jobId,
      trigger: "retry",
      attempt: nextAttempt,
      started_at: now,
      finished_at: now,
      status: nextStatus,
      error_code: error.code || null,
      error_message: error.message,
    })
    return { nextStatus, retryInMinutes }
  }

  await executeSql(
    `UPDATE automation_jobs
     SET status = $1,
         attempts = $2,
         next_attempt_at = $3,
         lease_owner = NULL,
         lease_expires_at = NULL,
         last_error_code = $4,
         last_error_message = $5,
         updated_at = NOW()
     WHERE id = $6`,
    [
      nextStatus,
      nextAttempt,
      nextAttemptAt,
      error.code || null,
      error.message,
      jobId,
    ]
  )

  await executeSql(
    `INSERT INTO automation_runs (job_id, trigger, attempt, started_at, finished_at, status, error_code, error_message)
     VALUES ($1, 'retry', $2, $3, $3, $4, $5, $6)`,
    [jobId, nextAttempt, now, nextStatus, error.code || null, error.message]
  )

  return { nextStatus, retryInMinutes }
}

export async function cancelScheduledJob(
  recordId: string
): Promise<{ success: boolean; error?: string; status?: number }> {
  let activeJob: AutomationJobRow | null = null

  if (isMockDb()) {
    activeJob = getMockDb().findActiveJobByRecordId(recordId)
  } else {
    const rows = await executeSql<AutomationJobRow>(
      `SELECT * FROM automation_jobs 
       WHERE record_id = $1 AND status IN ('Scheduled', 'Publishing', 'Retry Pending')
       ORDER BY created_at DESC LIMIT 1`,
      [recordId]
    )
    activeJob = rows[0] || null
  }

  if (!activeJob) {
    return { success: true }
  }

  // Conflict: cannot cancel while publishing
  if (activeJob.status === "Publishing") {
    return {
      success: false,
      error: "Cannot cancel a post that is currently publishing to Instagram",
      status: 409,
    }
  }

  if (isMockDb()) {
    getMockDb().updateJob(activeJob.id, {
      status: "Cancelled",
      lease_owner: null,
      lease_expires_at: null,
    })
    return { success: true }
  }

  await executeSql(
    `UPDATE automation_jobs
     SET status = 'Cancelled', lease_owner = NULL, lease_expires_at = NULL, updated_at = NOW()
     WHERE id = $1`,
    [activeJob.id]
  )

  return { success: true }
}

export async function getActiveJobByRecordId(
  recordId: string
): Promise<AutomationJobRow | null> {
  if (isMockDb()) {
    return getMockDb().findActiveJobByRecordId(recordId)
  }
  const rows = await executeSql<AutomationJobRow>(
    `SELECT * FROM automation_jobs 
     WHERE record_id = $1 AND status IN ('Scheduled', 'Publishing', 'Retry Pending')
     ORDER BY created_at DESC LIMIT 1`,
    [recordId]
  )
  return rows[0] || null
}
