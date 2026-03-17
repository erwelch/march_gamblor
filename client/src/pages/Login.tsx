import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Ensure a profile row exists for this user
      await apiFetch('/api/profile').catch(() => {})
      navigate('/dashboard')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-orange-400">🏀 March Gamblor</h1>
          <p className="mt-2 text-gray-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-gray-900 p-6 ring-1 ring-gray-800">
          {error && (
            <div className="rounded-lg bg-red-900/40 px-4 py-2 text-sm text-red-300 ring-1 ring-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-gray-400">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white ring-1 ring-gray-700 focus:outline-none focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white ring-1 ring-gray-700 focus:outline-none focus:ring-orange-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-center text-sm">
            <Link to="/forgot-password" className="text-gray-500 hover:text-orange-400">
              Forgot password?
            </Link>
          </p>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          No account?{' '}
          <Link to="/signup" className="text-orange-400 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
