'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NavBarProps {
  username: string
  balance: number
}

export default function NavBar({ username, balance }: NavBarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navLinks = [
    { href: '/dashboard', label: 'Games' },
    { href: '/dashboard/my-bets', label: 'My Bets' },
    { href: '/dashboard/leaderboard', label: 'Leaderboard' },
  ]

  return (
    <nav className="border-b border-gray-800 bg-gray-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold text-orange-400">
            🏀 March Gamblor
          </Link>
          <div className="hidden items-center gap-1 sm:flex">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
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
          <div className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm">
            <span className="text-gray-400">Balance: </span>
            <span className="font-semibold text-green-400">{balance.toLocaleString()} cr</span>
          </div>
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
  )
}
