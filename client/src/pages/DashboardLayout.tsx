import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'
import { useSSE } from '../lib/useSSE'

export default function DashboardLayout() {
  const [username, setUsername] = useState('')
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, balance')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUsername(profile.username)
        setBalance(profile.balance)
      }
    }
    loadProfile()
  }, [])

  useSSE({
    'balance-updated': (data) => {
      const { balance } = data as { userId: string; balance: number }
      setBalance(balance)
    },
  })

  return (
    <div className="min-h-screen">
      <NavBar username={username} balance={balance} onBalanceChange={setBalance} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
