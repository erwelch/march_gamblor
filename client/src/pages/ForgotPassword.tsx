import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-orange-400">🏀 March Gamblor</h1>
          <p className="mt-2 text-gray-400">Reset your password</p>
        </div>

        <div className="space-y-4 rounded-xl bg-gray-900 p-6 ring-1 ring-gray-800">
          {sent ? (
            <p className="text-center text-sm text-green-400">
              Check your email for a password reset link.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to="/login" className="text-orange-400 hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
