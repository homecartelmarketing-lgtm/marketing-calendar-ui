import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 300

// Server-side-only trigger for /api/schedules/runner so a client (e.g. the
// Content Calendar UI) can ask due jobs to be processed immediately without
// ever seeing CRON_SECRET. Mirrors the "trigger-runner" action already used
// by app/api/scheduler-debug/route.ts.
export async function POST(request: NextRequest) {
  try {
    const originUrl = request.nextUrl.origin
    const cronSecret = process.env.CRON_SECRET?.trim()

    const runnerRes = await fetch(new URL("/api/schedules/runner", originUrl).toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      cache: "no-store",
    })

    const runnerData = await runnerRes.json().catch(() => ({}))

    return NextResponse.json({
      success: runnerRes.ok,
      status: runnerRes.status,
      response: runnerData,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to trigger runner" },
      { status: 500 }
    )
  }
}
