import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculatePayout } from '@/lib/odds'

// Vercel Cron: runs every 5 minutes while games are live
// vercel.json: { "crons": [{ "path": "/api/cron/sync-scores", "schedule": "*/5 * * * *" }] }

interface NcaaGame {
  gameID: string
  startTime: string
  status: string
  home: { names: { short: string }; score: string }
  away: { names: { short: string }; score: string }
}

async function fetchScoresForDate(dateStr: string): Promise<NcaaGame[]> {
  const url = `https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1/${dateStr}`
  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.games ?? []).map((e: { game: NcaaGame }) => e.game)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Fetch today and yesterday (for late-finishing games)
  const now = new Date()
  const today = now.toISOString().substring(0, 10).replace(/-/g, '/')
  const yesterday = new Date(now.getTime() - 86400000).toISOString().substring(0, 10).replace(/-/g, '/')

  const [todayGames, yesterdayGames] = await Promise.all([
    fetchScoresForDate(today),
    fetchScoresForDate(yesterday),
  ])

  const allGames = [...todayGames, ...yesterdayGames]
  let updated = 0
  let settled = 0

  for (const g of allGames) {
    const homeScore = parseInt(g.home.score) || null
    const awayScore = parseInt(g.away.score) || null

    // Map NCAA API status to our enum
    let status: 'scheduled' | 'live' | 'final' = 'scheduled'
    const rawStatus = (g.status ?? '').toLowerCase()
    if (rawStatus === 'final' || rawStatus === 'final/ot') {
      status = 'final'
    } else if (rawStatus !== '' && rawStatus !== 'scheduled' && rawStatus !== 'ppd') {
      status = 'live'
    }

    const { data: game } = await supabase
      .from('games')
      .update({ home_score: homeScore, away_score: awayScore, status, updated_at: new Date().toISOString() })
      .eq('ncaa_game_id', g.gameID)
      .select('id, status')
      .single()

    if (!game) continue
    updated++

    // Settle bets for final games
    if (status === 'final' && homeScore !== null && awayScore !== null) {
      const { data: unsettledBets } = await supabase
        .from('bets')
        .select('*')
        .eq('game_id', game.id)
        .is('result', null)

      if (!unsettledBets?.length) continue

      const { data: oddsRow } = await supabase
        .from('odds')
        .select('*')
        .eq('game_id', game.id)
        .single()

      for (const bet of unsettledBets) {
        let result: 'win' | 'loss' | 'push' = 'loss'
        let payout = 0

        if (bet.market === 'h2h') {
          const homeWon = homeScore > awayScore
          if ((bet.pick === 'home' && homeWon) || (bet.pick === 'away' && !homeWon)) {
            result = 'win'
            payout = calculatePayout(bet.amount, bet.odds_at_place)
          }
        } else if (bet.market === 'spreads' && oddsRow?.home_spread !== null) {
          const spread = oddsRow!.home_spread!
          const adjustedHome = homeScore + spread
          if (adjustedHome === awayScore) {
            result = 'push'
          } else if (
            (bet.pick === 'home' && adjustedHome > awayScore) ||
            (bet.pick === 'away' && adjustedHome < awayScore)
          ) {
            result = 'win'
            payout = calculatePayout(bet.amount, bet.odds_at_place)
          }
        } else if (bet.market === 'totals' && oddsRow?.over_under !== null) {
          const total = homeScore + awayScore
          const line = oddsRow!.over_under!
          if (total === line) {
            result = 'push'
          } else if (
            (bet.pick === 'over' && total > line) ||
            (bet.pick === 'under' && total < line)
          ) {
            result = 'win'
            payout = calculatePayout(bet.amount, bet.odds_at_place)
          }
        }

        await supabase
          .from('bets')
          .update({ result, payout, settled_at: new Date().toISOString() })
          .eq('id', bet.id)

        settled++
      }
    }
  }

  return NextResponse.json({ ok: true, updated, settled })
}
