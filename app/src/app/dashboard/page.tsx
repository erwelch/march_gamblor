import { createClient } from '@/lib/supabase/server'
import type { GameWithOdds } from '@/lib/supabase/types'
import GameCard from '@/components/GameCard'
import { syncOdds } from '@/lib/syncOdds'

export const revalidate = 0 // always fetch fresh on load

export default async function DashboardPage() {
  // Sync latest odds from the API on every page load
  const syncResult = await syncOdds().catch((e: unknown) => ({ error: String(e), upserted: 0, total: 0 }))
  console.log('[syncOdds]', syncResult)

  const supabase = await createClient()

  const { data: rawGames } = await supabase
    .from('games')
    .select('*, odds(*)')
    .in('status', ['scheduled', 'live'])
    .order('start_time', { ascending: true })
    .limit(50)

  // PostgREST returns odds as an array; unwrap to single object for GameWithOdds
  const games = (rawGames ?? []).map(g => ({ ...g, odds: Array.isArray(g.odds) ? (g.odds[0] ?? null) : g.odds }))

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch the IDs of games the user already has open bets on
  const { data: existingBets } = user
    ? await supabase
        .from('bets')
        .select('game_id, market')
        .eq('user_id', user.id)
        .is('result', null)
    : { data: [] }

  const bettedKeys = (existingBets ?? []).map(b => `${b.game_id}:${b.market}`)

  const gameList = games as GameWithOdds[]

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-gray-100">Upcoming &amp; Live Games</h2>

      {gameList.length === 0 ? (
        <div className="rounded-xl bg-gray-900 p-8 text-center text-gray-500">
          No games available right now. Odds sync every 30 minutes during the tournament.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gameList.map(game => (
            <GameCard
              key={game.id}
              game={game}
              bettedKeys={bettedKeys}
            />
          ))}
        </div>
      )}
    </div>
  )
}
