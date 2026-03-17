import { NextRequest, NextResponse } from 'next/server'
import { syncOdds } from '@/lib/syncOdds'

// Vercel Cron: disabled for now — odds are synced on each dashboard page load
// vercel.json: { "crons": [{ "path": "/api/cron/sync-odds", "schedule": "*/30 * * * *" }] }

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await syncOdds()
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  return NextResponse.json({ ok: true, upserted: result.upserted, total: result.total })
}
