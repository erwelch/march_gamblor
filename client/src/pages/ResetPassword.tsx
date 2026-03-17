import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  // Supabase fires PASSWORD_RECOVERY after the magic link is followed.
  // We wait for that event before showing the form.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-orange-400">🏀 March Gamblor</h1>
          <p className="mt-2 text-gray-400">Choose a new password</p>
        </div>

        <div className="rounded-xl bg-gray-900 p-6 ring-1 ring-gray-800">
          {!ready ? (
            <p className="text-center text-sm text-gray-400">Verifying reset link…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-900/40 px-4 py-2 text-sm text-red-300 ring-1 ring-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm text-gray-400">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white ring-1 ring-gray-700 focus:outline-none focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full rounded-lg bg-gray-800 px-3 py-2 text-sm text-white ring-1 ring-gray-700 focus:outline-none focus:ring-orange-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
