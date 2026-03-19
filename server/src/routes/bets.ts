import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../plugins/auth'
import { calculatePayout } from '../lib/odds'
import { createServiceClient } from '../lib/supabase'
import { broadcast } from '../lib/broadcaster'
import type { Database } from '../lib/types'

type BetInsert = Database['public']['Tables']['bets']['Insert']

export async function betsRoutes(app: FastifyInstance) {
  app.get('/bets', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user
    const supabase = (request as any).supabase

    const { data: bets, error } = await supabase
      .from('bets')
      .select('*, games(home_team, away_team, status, home_score, away_score)')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false })

    if (error) {
      console.error('Bets fetch error:', error)
      return reply.status(500).send({ error: 'Failed to fetch bets' })
    }

    return reply.send({ bets: bets ?? [] })
  })

  app.post('/bets', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user
    const supabase = (request as any).supabase

    const body = request.body as Partial<BetInsert>
    const { game_id, market, pick, amount } = body

    if (!game_id || !market || !pick || !amount) {
      return reply.status(400).send({ error: 'Missing required fields' })
    }

    if (typeof amount !== 'number' || amount < 1 || amount > 100000 || !Number.isInteger(amount)) {
      return reply.status(400).send({ error: 'Invalid amount' })
    }

    const validMarkets = ['h2h', 'spreads', 'totals']
    const validPicks = ['home', 'away', 'over', 'under']
    if (!validMarkets.includes(market) || !validPicks.includes(pick)) {
      return reply.status(400).send({ error: 'Invalid market or pick' })
    }

    const { data: game } = await supabase
      .from('games')
      .select('id, status, start_time, home_team, away_team')
      .eq('id', game_id)
      .single()

    if (!game) return reply.status(404).send({ error: 'Game not found' })

    if (game.status !== 'scheduled' || new Date(game.start_time) <= new Date()) {
      return reply.status(409).send({ error: 'Betting is closed for this game' })
    }

    if (market === 'totals' && (pick === 'home' || pick === 'away')) {
      return reply.status(400).send({ error: 'Use over/under for totals market' })
    }
    if ((market === 'h2h' || market === 'spreads') && (pick === 'over' || pick === 'under')) {
      return reply.status(400).send({ error: 'Use home/away for h2h/spreads market' })
    }

    const { data: oddsRow } = await supabase
      .from('odds')
      .select('*')
      .eq('game_id', game_id)
      .single()

    if (!oddsRow) return reply.status(409).send({ error: 'No odds available for this game' })

    let odds_at_place: number | null = null
    let line_at_place: number | null = null
    if (market === 'h2h') {
      odds_at_place = pick === 'home' ? oddsRow.home_ml : oddsRow.away_ml
    } else if (market === 'spreads') {
      odds_at_place = pick === 'home' ? oddsRow.home_spread_price : oddsRow.away_spread_price
      line_at_place = oddsRow.home_spread
    } else if (market === 'totals') {
      odds_at_place = pick === 'over' ? oddsRow.over_price : oddsRow.under_price
      line_at_place = oddsRow.over_under
    }

    if (odds_at_place === null) {
      return reply.status(409).send({ error: 'Odds not available for this pick' })
    }

    const serviceClient = createServiceClient()

    // Check sufficient balance before inserting — the DB trigger handles the actual deduction.
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.balance || profile.balance < amount) {
      return reply.status(409).send({ error: 'Insufficient balance' })
    }

    // The DB trigger on bets INSERT atomically deducts profile.balance.
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert({ user_id: user.id, game_id, market, pick, amount, odds_at_place, line_at_place })
      .select()
      .single()

    if (betError) {
      console.error('Bet insert error:', betError)
      return reply.status(500).send({ error: 'Failed to place bet' })
    }

    // Read the post-deduction balance (set by the trigger) to broadcast to the client.
    const { data: updatedProfile } = await serviceClient
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single()

    if (updatedProfile) {
      broadcast('balance-updated', { userId: user.id, balance: updatedProfile.balance })
    }

    return reply.status(201).send({
      bet,
      new_balance: updatedProfile?.balance,
      potential_payout: calculatePayout(amount, odds_at_place),
    })
  })

  app.patch('/bets/:id/line', { preHandler: requireAuth }, async (request, reply) => {
    const user = (request as any).user
    const supabase = (request as any).supabase
    const { id } = request.params as { id: string }
    const { line_at_place } = request.body as { line_at_place: unknown }

    if (typeof line_at_place !== 'number' || !isFinite(line_at_place)) {
      return reply.status(400).send({ error: 'line_at_place must be a finite number' })
    }

    // Fetch the bet with full fields needed for potential recalculation
    const { data: bet, error: fetchError } = await supabase
      .from('bets')
      .select('id, result, payout, market, pick, amount, odds_at_place, game_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !bet) return reply.status(404).send({ error: 'Bet not found' })
    if (bet.market !== 'spreads' && bet.market !== 'totals') {
      return reply.status(400).send({ error: 'line_at_place only applies to spreads and totals' })
    }

    const serviceClient = createServiceClient()

    // If this bet is already settled on a final game, recalculate result/payout with the new line
    if (bet.result !== null) {
      const { data: game } = await serviceClient
        .from('games')
        .select('status, home_score, away_score')
        .eq('id', bet.game_id)
        .single()

      if (!game || game.status !== 'final' || game.home_score === null || game.away_score === null) {
        return reply.status(409).send({ error: 'Cannot recalculate: game scores not available' })
      }

      const homeScore = game.home_score as number
      const awayScore = game.away_score as number

      let newResult: 'win' | 'loss' | 'push' = 'loss'
      let newPayout = 0

      if (bet.market === 'spreads') {
        const adjustedHome = homeScore + line_at_place
        if (adjustedHome === awayScore) {
          newResult = 'push'
        } else if (
          (bet.pick === 'home' && adjustedHome > awayScore) ||
          (bet.pick === 'away' && adjustedHome < awayScore)
        ) {
          newResult = 'win'
          newPayout = calculatePayout(bet.amount, bet.odds_at_place)
        }
      } else if (bet.market === 'totals') {
        const total = homeScore + awayScore
        if (total === line_at_place) {
          newResult = 'push'
        } else if (
          (bet.pick === 'over' && total > line_at_place) ||
          (bet.pick === 'under' && total < line_at_place)
        ) {
          newResult = 'win'
          newPayout = calculatePayout(bet.amount, bet.odds_at_place)
        }
      }

      // Manually reverse the old settlement credit and apply the new one.
      // The existing trigger only fires on initial settlement (old.result IS NULL → new.result IS NOT NULL),
      // so recalculation balance adjustments must be done here until the trigger is updated.
      const oldCredit = bet.result === 'win' ? (bet.payout ?? 0) : bet.result === 'push' ? bet.amount : 0
      const newCredit = newResult === 'win' ? newPayout : newResult === 'push' ? bet.amount : 0
      if (oldCredit !== newCredit) {
        const { data: prof } = await serviceClient.from('profiles').select('balance').eq('id', user.id).single()
        if (prof) {
          await serviceClient.from('profiles').update({ balance: (prof.balance ?? 0) - oldCredit + newCredit }).eq('id', user.id)
        }
      }

      // Update bet with new line, result, payout, settled_at.
      // Skip the trigger's credit by using serviceClient — the trigger will still fire but since
      // old.result is NOT NULL the current trigger does nothing (it only handles initial settlement).
      const { error: updateError } = await serviceClient
        .from('bets')
        .update({
          line_at_place,
          result: newResult,
          payout: newPayout,
          settled_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        console.error('Bet recalculation update error:', updateError)
        return reply.status(500).send({ error: 'Failed to update bet' })
      }

      // Read updated balance to broadcast
      const { data: updatedProfile } = await serviceClient.from('profiles').select('balance').eq('id', user.id).single()
      if (updatedProfile) {
        broadcast('balance-updated', { userId: user.id, balance: updatedProfile.balance })
      }

      return reply.send({ ok: true, line_at_place, result: newResult, payout: newPayout })
    }

    // Bet is not yet settled — just update the line
    const { error: updateError } = await supabase
      .from('bets')
      .update({ line_at_place })
      .eq('id', id)

    if (updateError) {
      console.error('Line update error:', updateError)
      return reply.status(500).send({ error: 'Failed to update line' })
    }

    return reply.send({ ok: true, line_at_place })
  })
}