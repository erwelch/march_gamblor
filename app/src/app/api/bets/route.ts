import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculatePayout } from '@/lib/odds'
import type { Database } from '@/lib/supabase/types'

type BetInsert = Database['public']['Tables']['bets']['Insert']

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { game_id, market, pick, amount } = body as Partial<BetInsert>

  // Input validation
  if (!game_id || !market || !pick || !amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (typeof amount !== 'number' || amount < 1 || amount > 100000 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const validMarkets = ['h2h', 'spreads', 'totals']
  const validPicks = ['home', 'away', 'over', 'under']
  if (!validMarkets.includes(market) || !validPicks.includes(pick)) {
    return NextResponse.json({ error: 'Invalid market or pick' }, { status: 400 })
  }

  // Verify the game exists, is scheduled, and hasn't started yet
  const { data: game } = await supabase
    .from('games')
    .select('id, status, start_time, home_team, away_team')
    .eq('id', game_id)
    .single()

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  if (game.status !== 'scheduled' || new Date(game.start_time) <= new Date()) {
    return NextResponse.json({ error: 'Betting is closed for this game' }, { status: 409 })
  }

  // Validate pick makes sense for market
  if (market === 'totals' && (pick === 'home' || pick === 'away')) {
    return NextResponse.json({ error: 'Use over/under for totals market' }, { status: 400 })
  }
  if ((market === 'h2h' || market === 'spreads') && (pick === 'over' || pick === 'under')) {
    return NextResponse.json({ error: 'Use home/away for h2h/spreads market' }, { status: 400 })
  }

  // Get current odds for this game
  const { data: oddsRow } = await supabase
    .from('odds')
    .select('*')
    .eq('game_id', game_id)
    .single()

  if (!oddsRow) {
    return NextResponse.json({ error: 'No odds available for this game' }, { status: 409 })
  }

  // Determine the odds for the specific pick
  let odds_at_place: number | null = null
  if (market === 'h2h') {
    odds_at_place = pick === 'home' ? oddsRow.home_ml : oddsRow.away_ml
  } else if (market === 'spreads') {
    odds_at_place = pick === 'home' ? oddsRow.home_spread_price : oddsRow.away_spread_price
  } else if (market === 'totals') {
    odds_at_place = pick === 'over' ? oddsRow.over_price : oddsRow.under_price
  }

  if (odds_at_place === null) {
    return NextResponse.json({ error: 'Odds not available for this pick' }, { status: 409 })
  }

  // Check user balance
  const { data: profile } = await supabase
    .from('profiles')
    .select('balance')
    .eq('id', user.id)
    .single()

  if (!profile || profile.balance < amount) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 409 })
  }

  // Insert the bet (the DB trigger will deduct the balance)
  const { data: bet, error: betError } = await supabase
    .from('bets')
    .insert({
      user_id: user.id,
      game_id,
      market,
      pick,
      amount,
      odds_at_place,
    })
    .select()
    .single()

  if (betError) {
    console.error('Bet insert error:', betError)
    return NextResponse.json({ error: 'Failed to place bet' }, { status: 500 })
  }

  return NextResponse.json({
    bet,
    potential_payout: calculatePayout(amount, odds_at_place),
  }, { status: 201 })
}
