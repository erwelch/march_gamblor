import { createClient } from '@/lib/supabase/server'

export const revalidate = 60

export default async function LeaderboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, balance')
    .order('balance', { ascending: false })

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-gray-100">Leaderboard</h2>

      <div className="overflow-hidden rounded-xl bg-gray-900 ring-1 ring-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs text-gray-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3 text-right">+/- vs Start</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p, i) => {
              const isMe = p.id === user?.id
              const delta = p.balance - 1000
              return (
                <tr
                  key={p.id}
                  className={`border-b border-gray-800/50 last:border-0 ${isMe ? 'bg-orange-500/5' : ''}`}
                >
                  <td className="px-4 py-3 font-mono text-gray-500">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-200">
                    {p.username}
                    {isMe && <span className="ml-2 text-xs text-orange-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-100">
                    {p.balance.toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {delta >= 0 ? '+' : ''}{delta.toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
