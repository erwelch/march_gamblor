import type { FastifyInstance } from 'fastify'
import { syncOdds2 as syncOdds } from '../lib/syncOdds2'
import { createServiceClient } from '../lib/supabase'
import { calculatePayout } from '../lib/odds'
import { broadcast } from '../lib/broadcaster'
import { matchNcaaGameToDbGame } from '../lib/teamNames'

interface NcaaTeamNames {
  short?: string
  full?: string
  seo?: string
  char6?: string
}

interface NcaaTeam {
  teamId?: string
  names?: NcaaTeamNames
  score?: string | number
  isTop25?: boolean
  [key: string]: unknown
}

interface NcaaGame {
  gameID?: string
  game?: {
    gameID?: string
    away?: NcaaTeam
    home?: NcaaTeam
    gameState?: string // 'pre', 'live', 'final'
    startDate?: string
    startTime?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface NcaaScoreboardResponse {
  games?: NcaaGame[]
  [key: string]: unknown
}

const NCAA_SCOREBOARD_BASE = 'https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1'

async function fetchNcaaScoreboard(dateStr: string): Promise<NcaaGame[]> {
  // dateStr format: YYYY/MM/DD
  const url = `${NCAA_SCOREBOARD_BASE}/${dateStr}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`NCAA API returned ${res.status} for ${url}`)
  }
  const data = (await res.json()) as NcaaScoreboardResponse
  return data.games ?? []
}

function toNcaaDatePath(d: Date): string {
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}/${mm}/${dd}`
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
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
    const yesterday = new Date(now)
    yesterday.setUTCDate(now.getUTCDate() - 1)

    const todayIso = toIsoDate(now)
    const yesterdayIso = toIsoDate(yesterday)

    // Fetch NCAA scoreboards for today and yesterday in parallel
    let ncaaGamesToday: NcaaGame[]
    let ncaaGamesYesterday: NcaaGame[]
    try {
      ;[ncaaGamesToday, ncaaGamesYesterday] = await Promise.all([
        fetchNcaaScoreboard(toNcaaDatePath(now)),
        fetchNcaaScoreboard(toNcaaDatePath(yesterday)),
      ])
    } catch (err: any) {
      console.error('[cron/sync-scores] Failed to fetch NCAA scoreboard:', err?.message ?? err)
      return reply.status(502).send({ error: `Failed to fetch NCAA scoreboard: ${err?.message ?? err}` })
    }

    // Only process games that are live or final (skip pre-game)
    const allNcaaGames = [...ncaaGamesToday, ...ncaaGamesYesterday].filter((g) => {
      const state = g.game?.gameState
      return state === 'live' || state === 'final'
    })

    console.log(`[cron/sync-scores] Fetched ${allNcaaGames.length} live/final NCAA games`)

    // Fetch DB games for today and yesterday that may need updating
    const { data: dbGames } = await supabase
      .from('games')
      .select('*')
      .in('game_date', [todayIso, yesterdayIso])
      .in('status', ['scheduled', 'live'])

    if (!dbGames?.length) {
      console.log('[cron/sync-scores] No scheduled/live DB games found for today or yesterday')
      return reply.send({ ok: true, updated: 0, settled: 0 })
    }

    // Also fetch any DB games already marked final but potentially missing settlement
    const { data: finalDbGames } = await supabase
      .from('games')
      .select('*')
      .in('game_date', [todayIso, yesterdayIso])
      .eq('status', 'final')

    const allDbGames = [...(dbGames ?? []), ...(finalDbGames ?? [])]

    let updated = 0
    let settled = 0

    for (const ncaaGame of allNcaaGames) {
      const inner = ncaaGame.game
      if (!inner) continue

      const ncaaId = inner.gameID ?? ncaaGame.gameID
      if (!ncaaId) continue

      const homeTeamNames = inner.home?.names
      const awayTeamNames = inner.away?.names
      const ncaaHomeName = homeTeamNames?.short ?? homeTeamNames?.full ?? ''
      const ncaaAwayName = awayTeamNames?.short ?? awayTeamNames?.full ?? ''

      const homeScore = inner.home?.score != null ? Number(inner.home.score) : null
      const awayScore = inner.away?.score != null ? Number(inner.away.score) : null

      const ncaaState = inner.gameState
      const status: 'scheduled' | 'live' | 'final' =
        ncaaState === 'final' ? 'final' : ncaaState === 'live' ? 'live' : 'scheduled'

      // Determine the game_date for this NCAA game — use start date if available, else infer from which day it came from
      // The NCAA API startDate might be in format like "03/17/2026"
      let gameDate: string
      if (inner.startDate) {
        // Convert MM/DD/YYYY → YYYY-MM-DD
        const parts = String(inner.startDate).split('/')
        if (parts.length === 3) {
          gameDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
        } else {
          gameDate = todayIso
        }
      } else {
        gameDate = todayIso
      }

      // Fast path: look up by ncaa_scoreboard_id
      let dbGame = allDbGames.find((g) => (g as any).ncaa_scoreboard_id === ncaaId) ?? null

      // Link path: fuzzy match by team names + date, then store the ID
      if (!dbGame) {
        dbGame = matchNcaaGameToDbGame(ncaaHomeName, ncaaAwayName, gameDate, allDbGames)

        if (dbGame) {
          console.log(
            `[cron/sync-scores] Linked NCAA game ${ncaaId} (${ncaaAwayName} @ ${ncaaHomeName}) → DB game ${dbGame.id}`
          )
          // Store NCAA scoreboard ID for future fast-path lookups
          await supabase
            .from('games')
            .update({ ncaa_scoreboard_id: ncaaId } as any)
            .eq('id', dbGame.id)
        } else {
          console.warn(
            `[cron/sync-scores] No DB match for NCAA game ${ncaaId}: ${ncaaAwayName} @ ${ncaaHomeName} on ${gameDate}`
          )
          continue
        }
      }

      // Update scores and status
      const { data: updatedGame } = await supabase
        .from('games')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbGame.id)
        .select('id, status')
        .single()

      if (!updatedGame) continue
      updated++

      // Settle bets on final games
      if (status === 'final' && homeScore !== null && awayScore !== null) {
        const { data: unsettledBets } = await supabase
          .from('bets')
          .select('*')
          .eq('game_id', dbGame.id)
          .is('result', null)

        if (!unsettledBets?.length) continue

        const { data: oddsRow } = await supabase
          .from('odds')
          .select('*')
          .eq('game_id', dbGame.id)
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
          // Balance is credited by the DB trigger on bets UPDATE (win → payout, push → amount).

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