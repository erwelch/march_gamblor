import { Outlet } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'
import { useSSE } from '../lib/useSSE'

export default function DashboardLayout() {
  const [username, setUsername] = useState('')
  const [balance, setBalance] = useState(0)
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      currentUserIdRef.current = data.session?.user?.id ?? null
    })

    apiFetch('/api/profile')
      .then(res => res.json())
      .then(data => {
        if (data?.profile) {
          setUsername(data.profile.username)
          setBalance(data.profile.balance)
        }
      })
      .catch(() => {})
  }, [])

  useSSE({
    'balance-updated': (data) => {
      const { userId, balance } = data as { userId: string; balance: number }
      if (userId === currentUserIdRef.current) {
        setBalance(balance)
      }
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
