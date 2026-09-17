import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  validateFuturePhtSchedule,
  computeMediaVersion,
  deriveIdempotencyKey,
  createOrReplaceScheduledJob,
  claimDueJobs,
  recordJobSuccess,
  recordJobFailure,
  cancelScheduledJob,
} from "@/server/automation/jobs"
import { resetMockDb, getMockDb } from "@/server/db/client"
import { POST as runnerPost, GET as runnerGet } from "@/app/api/schedules/runner/route"
import { POST as schedulesPost, DELETE as schedulesDelete } from "@/app/api/schedules/route"
import { POST as schedulesTriggerPost } from "@/app/api/schedules/trigger/route"
import { NextRequest } from "next/server"

describe("Durable Scheduling & Queue Tests", () => {
  beforeEach(() => {
    resetMockDb()
    vi.restoreAllMocks()
  })

  describe("PHT Future Validation & Idempotency", () => {
    const referenceNow = new Date("2026-09-15T08:00:00+08:00") // 8:00 AM PHT

    it("accepts a future PHT timestamp", () => {
      const result = validateFuturePhtSchedule("2026-09-15", "10:30", referenceNow)
      expect(result.scheduledIso).toBe("2026-09-15")
      expect(result.timePht).toBe("10:30")
      expect(result.scheduledTime.toISOString()).toBe("2026-09-15T02:30:00.000Z")
    })

    it("normalizes and accepts single-digit hour PHT times like '9:00'", () => {
      const result = validateFuturePhtSchedule("2026-09-15", "9:00", referenceNow)
      expect(result.scheduledIso).toBe("2026-09-15")
      expect(result.timePht).toBe("09:00")
      expect(result.scheduledTime.toISOString()).toBe("2026-09-15T01:00:00.000Z")
    })

    it("rejects a past PHT timestamp on the same day", () => {
      expect(() =>
        validateFuturePhtSchedule("2026-09-15", "07:30", referenceNow)
      ).toThrow(/Scheduled time must be in the future/)
    })

    it("rejects an expired calendar date", () => {
      expect(() =>
        validateFuturePhtSchedule("2026-09-14", "12:00", referenceNow)
      ).toThrow(/Scheduled time must be in the future/)
    })

    it("rejects non-existent dates or malformed times", () => {
      expect(() =>
        validateFuturePhtSchedule("2026-02-30", "12:00", referenceNow)
      ).toThrow()
      expect(() =>
        validateFuturePhtSchedule("2026-09-15", "25:00", referenceNow)
      ).toThrow()
    })

    it("generates deterministic media version and idempotency key", () => {
      const version1 = computeMediaVersion({
        mediaType: "image",
        mediaUrl: "https://media.example/1.jpg",
        caption: "Test caption",
      })
      const version2 = computeMediaVersion({
        mediaType: "image",
        mediaUrl: "https://media.example/1.jpg",
        caption: "Test caption",
      })
      const version3 = computeMediaVersion({
        mediaType: "image",
        mediaUrl: "https://media.example/1.jpg",
        caption: "Changed caption",
      })

      expect(version1).toBe(version2)
      expect(version1).not.toBe(version3)

      const key = deriveIdempotencyKey(
        "recTest123",
        new Date("2026-09-15T02:30:00.000Z"),
        version1
      )
      expect(key).toBe("recTest123:2026-09-15T02:30:00.000Z:" + version1)
    })
  })

  describe("Job Lifecycle & Rescheduling", () => {
    const referenceNow = new Date("2026-09-15T08:00:00+08:00")

    it("creates scheduled job with locked snapshot", async () => {
      const job = await createOrReplaceScheduledJob({
        recordId: "rec123",
        tableId: "tbl456",
        category: "Stories",
        caption: "Beautiful Chandelier",
        mediaType: "image",
        mediaUrl: "https://media.example/chandelier.jpg",
        mediaUrls: ["https://media.example/chandelier.jpg"],
        isoDate: "2026-09-16",
        time: "14:00",
        referenceNow,
      })

      expect(job.status).toBe("Scheduled")
      expect(job.record_id).toBe("rec123")
      expect(job.table_id).toBe("tbl456")
      expect(job.caption).toBe("Beautiful Chandelier")
      expect(job.attempts).toBe(0)
    })

    it("cancels old job version when rescheduling the same record", async () => {
      const job1 = await createOrReplaceScheduledJob({
        recordId: "rec123",
        tableId: "tbl456",
        category: "Stories",
        caption: "Version 1",
        mediaType: "image",
        mediaUrl: "https://media.example/1.jpg",
        isoDate: "2026-09-16",
        time: "14:00",
        referenceNow,
      })

      const job2 = await createOrReplaceScheduledJob({
        recordId: "rec123",
        tableId: "tbl456",
        category: "Stories",
        caption: "Version 2 (Rescheduled)",
        mediaType: "image",
        mediaUrl: "https://media.example/2.jpg",
        isoDate: "2026-09-17",
        time: "15:00",
        referenceNow,
      })

      const storedJob1 = getMockDb().getJob(job1.id)
      const storedJob2 = getMockDb().getJob(job2.id)

      expect(storedJob1?.status).toBe("Cancelled")
      expect(storedJob2?.status).toBe("Scheduled")
      expect(storedJob2?.caption).toBe("Version 2 (Rescheduled)")
    })
  })

  describe("Atomic Claiming & Duplicate Prevention", () => {
    it("proves two concurrent runners cannot claim the same due job", async () => {
      const referenceNow = new Date("2026-09-15T08:00:00+08:00")
      // Create a job due at 09:00 AM
      const job = await createOrReplaceScheduledJob({
        recordId: "recRace",
        tableId: "tblRace",
        category: "Feeds",
        caption: "Race test",
        mediaType: "image",
        mediaUrl: "https://media.example/race.jpg",
        isoDate: "2026-09-15",
        time: "09:00",
        referenceNow,
      })

      // Simulate current time at 09:05 AM (job is due)
      const runnerTime = new Date("2026-09-15T09:05:00+08:00")

      // Two concurrent runner claims
      const [claim1, claim2] = await Promise.all([
        claimDueJobs({ now: runnerTime, runnerId: "runner_A" }),
        claimDueJobs({ now: runnerTime, runnerId: "runner_B" }),
      ])

      // Exactly one runner should receive the job!
      const totalClaimed = claim1.length + claim2.length
      expect(totalClaimed).toBe(1)
      const winningClaim = claim1.length > 0 ? claim1[0] : claim2[0]
      expect(winningClaim.id).toBe(job.id)
      expect(winningClaim.status).toBe("Publishing")
    })

    it("ensures Meta success with Airtable failure records Meta ID and prevents republishing", async () => {
      const referenceNow = new Date("2026-09-15T08:00:00+08:00")
      const job = await createOrReplaceScheduledJob({
        recordId: "recSafe",
        tableId: "tblSafe",
        category: "Stories",
        caption: "Resilience test",
        mediaType: "image",
        mediaUrl: "https://media.example/safe.jpg",
        isoDate: "2026-09-15",
        time: "09:00",
        referenceNow,
      })

      // Record Meta success
      await recordJobSuccess(job.id, ["meta_pub_12345"])

      const updated = getMockDb().getJob(job.id)
      expect(updated?.status).toBe("Posted")
      expect(updated?.meta_publication_ids).toEqual(["meta_pub_12345"])

      // Verify that subsequent runner claim queries never claim a Posted job
      const runnerTime = new Date("2026-09-15T09:30:00+08:00")
      const dueAfter = await claimDueJobs({ now: runnerTime, runnerId: "runner_C" })
      expect(dueAfter.some((j) => j.id === job.id)).toBe(false)
    })
  })

  describe("Cancellation & Conflicts", () => {
    const referenceNow = new Date("2026-09-15T08:00:00+08:00")

    it("cancels a scheduled job cleanly", async () => {
      const job = await createOrReplaceScheduledJob({
        recordId: "recCancel",
        tableId: "tblCancel",
        category: "Stories",
        caption: "To cancel",
        mediaType: "image",
        mediaUrl: "https://media.example/cancel.jpg",
        isoDate: "2026-09-16",
        time: "10:00",
        referenceNow,
      })

      const cancelRes = await cancelScheduledJob(job.record_id)
      expect(cancelRes.success).toBe(true)

      const stored = getMockDb().getJob(job.id)
      expect(stored?.status).toBe("Cancelled")
    })

    it("rejects cancellation if job is actively publishing (HTTP 409 conflict)", async () => {
      const job = await createOrReplaceScheduledJob({
        recordId: "recPublishing",
        tableId: "tblPublishing",
        category: "Stories",
        caption: "In flight",
        mediaType: "image",
        mediaUrl: "https://media.example/inflight.jpg",
        isoDate: "2026-09-15",
        time: "09:00",
        referenceNow,
      })

      // Claim job
      await claimDueJobs({
        now: new Date("2026-09-15T09:05:00+08:00"),
        runnerId: "runner_live",
      })

      const cancelRes = await cancelScheduledJob(job.record_id)
      expect(cancelRes.success).toBe(false)
      expect(cancelRes.status).toBe(409)
      expect(cancelRes.error).toMatch(/currently publishing/)
    })
  })

  describe("Retry Progression & Permanent Errors", () => {
    const referenceNow = new Date("2026-09-15T08:00:00+08:00")

    it("progresses retries: 1m -> 5m -> For Manual", async () => {
      const job = await createOrReplaceScheduledJob({
        recordId: "recRetry",
        tableId: "tblRetry",
        category: "Feeds",
        caption: "Retry test",
        mediaType: "image",
        mediaUrl: "https://media.example/retry.jpg",
        isoDate: "2026-09-16",
        time: "10:00",
        referenceNow,
      })

      // Attempt 1 failure (temporary network error)
      const res1 = await recordJobFailure(job.id, {
        message: "Meta rate limit exceeded (temporary)",
        isPermanent: false,
      })
      expect(res1.nextStatus).toBe("Retry Pending")
      expect(res1.retryInMinutes).toBe(1)

      // Attempt 2 failure
      const res2 = await recordJobFailure(job.id, {
        message: "Meta rate limit exceeded (temporary)",
        isPermanent: false,
      })
      expect(res2.nextStatus).toBe("Retry Pending")
      expect(res2.retryInMinutes).toBe(5)

      // Attempt 3 failure -> For Manual
      const res3 = await recordJobFailure(job.id, {
        message: "Meta rate limit exceeded (temporary)",
        isPermanent: false,
      })
      expect(res3.nextStatus).toBe("For Manual")
    })

    it("marks permanent content error immediately as For Manual", async () => {
      const job = await createOrReplaceScheduledJob({
        recordId: "recPerm",
        tableId: "tblPerm",
        category: "Stories",
        caption: "Permanent error test",
        mediaType: "image",
        mediaUrl: "https://media.example/perm.jpg",
        isoDate: "2026-09-16",
        time: "10:00",
        referenceNow,
      })

      const res = await recordJobFailure(job.id, {
        message: "Invalid media URL: aspect ratio unsupported by Instagram",
        isPermanent: true,
      })
      expect(res.nextStatus).toBe("For Manual")
      expect(res.retryInMinutes).toBeUndefined()
    })
  })

  describe("Runner Security & Endpoints", () => {
    it("rejects runner requests without Bearer authorization header", async () => {
      vi.stubEnv("CRON_SECRET", "super-secret-cron-token")

      const req = new NextRequest("http://localhost:3000/api/schedules/runner", {
        headers: {},
      })
      const res = await runnerGet(req)
      expect(res.status).toBe(401)
    })

    it("rejects runner requests using query parameter ?secret=", async () => {
      vi.stubEnv("CRON_SECRET", "super-secret-cron-token")

      // Query-string auth was removed for security
      const req = new NextRequest(
        "http://localhost:3000/api/schedules/runner?secret=super-secret-cron-token"
      )
      const res = await runnerGet(req)
      expect(res.status).toBe(401)
    })

    it("accepts runner requests with valid Authorization: Bearer <token>", async () => {
      vi.stubEnv("CRON_SECRET", "super-secret-cron-token")

      const req = new NextRequest("http://localhost:3000/api/schedules/runner", {
        headers: {
          Authorization: "Bearer super-secret-cron-token",
        },
      })
      const res = await runnerGet(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.summary).toBeDefined()
    })

    it("pauses execution when AUTOMATION_KILL_SWITCH is enabled", async () => {
      vi.stubEnv("CRON_SECRET", "super-secret-cron-token")
      vi.stubEnv("AUTOMATION_KILL_SWITCH", "true")

      const req = new NextRequest("http://localhost:3000/api/schedules/runner", {
        headers: {
          Authorization: "Bearer super-secret-cron-token",
        },
      })
      const res = await runnerGet(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.paused).toBe(true)
      expect(body.message).toMatch(/kill[ _]?switch/i)
    })
  })

  describe("POST /api/schedules/trigger (Calendar due-now runner nudge)", () => {
    it("forwards to the runner with the server-held CRON_SECRET, never requiring it from the client", async () => {
      vi.stubEnv("CRON_SECRET", "super-secret-cron-token")

      const fetchCalls: { url: string; headers: Record<string, string> }[] = []
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          fetchCalls.push({ url: String(url), headers: (init?.headers as Record<string, string>) || {} })
          return new Response(JSON.stringify({ success: true, summary: { processed: 1 } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        })
      )

      const req = new NextRequest("http://localhost:3000/api/schedules/trigger", { method: "POST" })
      const res = await schedulesTriggerPost(req)
      const body = await res.json()

      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0].url).toContain("/api/schedules/runner")
      expect(fetchCalls[0].headers.Authorization).toBe("Bearer super-secret-cron-token")

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.response.summary).toEqual({ processed: 1 })
    })

    it("reports failure without throwing when the runner call itself errors", async () => {
      vi.stubEnv("CRON_SECRET", "super-secret-cron-token")
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("network unreachable")
        })
      )

      const req = new NextRequest("http://localhost:3000/api/schedules/trigger", { method: "POST" })
      const res = await schedulesTriggerPost(req)
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.success).toBe(false)
      expect(body.error).toContain("network unreachable")
    })
  })

  describe("POST & DELETE /api/schedules Route Integration", () => {
    it("rejects scheduling with past PHT timestamp via POST /api/schedules", async () => {
      const req = new NextRequest("http://localhost:3000/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: "recTestPast",
          tableId: "tblTestPast",
          isoDate: "2020-01-01",
          time: "09:00",
          category: "Stories",
          caption: "Past post",
          mediaUrl: "https://media.example/photo.jpg",
          status: "Scheduled",
        }),
      })

      const res = await schedulesPost(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/future/i)
    })

    it("rejects scheduling when mediaUrl and slides are missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: "recNoMedia",
          tableId: "tblNoMedia",
          isoDate: "2030-01-01",
          time: "09:00",
          category: "Stories",
          caption: "No media",
          status: "Scheduled",
        }),
      })

      const res = await schedulesPost(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/media/i)
    })
  })
})
