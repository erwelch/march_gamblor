import { createClient } from '@/lib/supabase/server'
import type { GameWithOdds } from '@/lib/supabase/types'
import GameCard from '@/components/GameCard'

export const revalidate = 60 // revalidate every minute

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: games } = await supabase
    .from('games')
    .select('*, odds(*)')
    .in('status', ['scheduled', 'live'])
    .order('start_time', { ascending: true })
    .limit(50)

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch the IDs of games the user already has open bets on
  const { data: existingBets } = user
    ? await supabase
        .from('bets')
        .select('game_id, market')
        .eq('user_id', user.id)
        .is('result', null)
    : { data: [] }

  const betGameIds = new Set((existingBets ?? []).map(b => `${b.game_id}:${b.market}`))

  const gameList = (games ?? []) as GameWithOdds[]

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
              hasExistingBet={(market: string) => betGameIds.has(`${game.id}:${market}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
