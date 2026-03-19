import type { FastifyInstance } from 'fastify'
import { syncOdds2 as syncOdds } from '../lib/syncOdds2'
import { createServiceClient } from '../lib/supabase'
import { calculatePayout } from '../lib/odds'
import { broadcast } from '../lib/broadcaster'

interface NcaaGame {
  gameID: string
  startTime: string
  status: string
  home: { names: { short: string }; score: string }
  away: { names: { short: string }; score: string }
}

async function fetchScoresForDate(dateStr: string): Promise<NcaaGame[]> {
  const url = `https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1/${dateStr}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.games ?? []).map((e: { game: NcaaGame }) => e.game)
}

export async function cronRoutes(app: FastifyInstance) {
  app.get('/sync-odds', async (request, reply) => {
    console.log(`[cron/sync-odds] Request received from ${request.ip}`)
    if (request.headers['x-cron-api-key'] !== process.env.CRON_API_KEY) {
      console.warn('[cron/sync-odds] Unauthorized request - invalid or missing x-cron-api-key')
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    console.log('[cron/sync-odds] Starting odds sync...')
    const result = await syncOdds()
    if (result.error) {
      console.error('[cron/sync-odds] Sync failed:', result.error)
      return reply.status(502).send({ error: result.error })
    }

    console.log(`[cron/sync-odds] Done. upserted=${result.upserted} total=${result.total}`)
    return reply.send({ ok: true, upserted: result.upserted, total: result.total })
  })

  app.get('/sync-scores', async (request, reply) => {
    console.log(`[cron/sync-scores] Request received from ${request.ip}`)
    if (request.headers['x-cron-api-key'] !== process.env.CRON_API_KEY) {
      console.warn('[cron/sync-scores] Unauthorized request - invalid or missing x-cron-api-key')
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const supabase = createServiceClient()

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

    if (updated > 0) {
      broadcast('scores-updated', { updated, settled })
    }
    return reply.send({ ok: true, updated, settled })
  })
}