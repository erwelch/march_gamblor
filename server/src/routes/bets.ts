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
    if (market === 'h2h') {
      odds_at_place = pick === 'home' ? oddsRow.home_ml : oddsRow.away_ml
    } else if (market === 'spreads') {
      odds_at_place = pick === 'home' ? oddsRow.home_spread_price : oddsRow.away_spread_price
    } else if (market === 'totals') {
      odds_at_place = pick === 'over' ? oddsRow.over_price : oddsRow.under_price
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

    if (!profile || profile.balance < amount) {
      return reply.status(409).send({ error: 'Insufficient balance' })
    }

    // The DB trigger on bets INSERT atomically deducts profile.balance.
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert({ user_id: user.id, game_id, market, pick, amount, odds_at_place })
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
}