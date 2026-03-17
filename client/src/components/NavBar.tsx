import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'

interface NavBarProps {
  username: string
  balance: number
  onBalanceChange?: (newBalance: number) => void
}

export default function NavBar({ username, balance, onBalanceChange }: NavBarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositing, setDepositing] = useState(false)
  const [depositError, setDepositError] = useState('')

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function handleDeposit() {
    setDepositError('')
    const amount = Number(depositAmount)
    if (!depositAmount || !Number.isFinite(amount) || amount <= 0) {
      setDepositError('Enter a valid positive amount.')
      return
    }
    setDepositing(true)
    const res = await apiFetch('/api/profile/balance', {
      method: 'PATCH',
      body: JSON.stringify({ amount }),
    })
    setDepositing(false)
    if (res.ok) {
      const data = await res.json()
      onBalanceChange?.(data.balance)
      setDepositAmount('')
      setDepositOpen(false)
    } else {
      const err = await res.json().catch(() => ({}))
      setDepositError(err.error ?? 'Failed to add credits.')
    }
  }

  const navLinks = [
    { href: '/dashboard', label: 'Games' },
    { href: '/dashboard/bets', label: 'Bets' },
    { href: '/dashboard/leaderboard', label: 'Leaderboard' },
  ]

  return (
    <>
      <nav className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="text-lg font-bold text-orange-400">
              🏀 March Gamblor
            </Link>
            <div className="hidden items-center gap-1 sm:flex">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    pathname === link.href
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setDepositOpen(true); setDepositError('') }}
              className="flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-sm transition-colors hover:bg-gray-700"
            >
              <span className="text-gray-400">Balance:</span>
              <span className="font-semibold text-green-400">{balance.toLocaleString()} cr</span>
              <span className="ml-1 text-xs text-orange-400 cursor-pointer hover:text-orange-300 hover:scale-125 transition-transform inline-block">＋</span>
            </button>
            <span className="hidden text-sm text-gray-500 sm:block">{username}</span>
            <button
              onClick={handleSignOut}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {depositOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-900 p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-gray-100">Add Credits</h2>
            <p className="mb-4 text-sm text-gray-500">Honor system — be cool.</p>

            <label className="mb-1 block text-sm text-gray-400">Amount</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDeposit()}
              placeholder="200"
              className="mb-3 w-full rounded-lg bg-gray-800 px-3 py-2 text-gray-100 outline-none focus:ring-2 focus:ring-orange-500"
              autoFocus
            />

            {depositError && (
              <p className="mb-3 text-sm text-red-400">{depositError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleDeposit}
                disabled={depositing}
                className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                {depositing ? 'Adding…' : 'Add Credits'}
              </button>
              <button
                onClick={() => { setDepositOpen(false); setDepositAmount('') }}
                className="flex-1 rounded-lg bg-gray-800 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
