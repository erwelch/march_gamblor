import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { apiFetch } from './lib/api'
import type { Session } from '@supabase/supabase-js'
import LoginPage from './pages/Login'
import SignupPage from './pages/Signup'
import ForgotPasswordPage from './pages/ForgotPassword'
import ResetPasswordPage from './pages/ResetPassword'
import DashboardLayout from './pages/DashboardLayout'
import DashboardPage from './pages/Dashboard'
import LeaderboardPage from './pages/Leaderboard'
import BetsPage from './pages/Bets'

function PendingApproval() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="text-center max-w-md px-6">
        <div className="text-5xl mb-6">⏳</div>
        <h1 className="text-2xl font-bold mb-3">Pending Approval</h1>
        <p className="text-gray-400">
          Waiting for IT Admin to approve your account. Check back soon!
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-8 text-sm text-gray-500 hover:text-gray-300 underline"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [approved, setApproved] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setApproved(undefined); return }
    apiFetch('/api/profile')
      .then(res => res.json())
      .then(data => setApproved(data?.profile?.approved === true))
      .catch(() => setApproved(false))
  }, [session])

  if (session === undefined) return null // loading
  if (!session) return <Navigate to="/login" replace />
  if (approved === undefined) return null // loading profile
  if (!approved) return <PendingApproval />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="bets" element={<BetsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
