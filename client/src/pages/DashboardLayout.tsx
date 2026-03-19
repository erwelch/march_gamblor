import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import NavBar from '../components/NavBar'
import { useSSE } from '../lib/useSSE'

export default function DashboardLayout() {
  const [username, setUsername] = useState('')
  const [balance, setBalance] = useState(0)

  useEffect(() => {
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
