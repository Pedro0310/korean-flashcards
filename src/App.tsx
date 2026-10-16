import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ApiError, auth, errorMessage, SIGNED_OUT_EVENT } from './api.ts'
import Layout from './components/Layout.tsx'
import Privacy from './pages/Privacy.tsx'
import Review from './pages/Review.tsx'
import SignIn from './pages/SignIn.tsx'
import Stats from './pages/Stats.tsx'
import type { User } from '../shared/types.ts'

export default function App() {
  // undefined while checking for a session, null when nobody is signed in.
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  // A guest who asked to create an account or sign in.
  const [leavingGuest, setLeavingGuest] = useState(false)

  const signedIn = useCallback((u: User) => {
    setUser(u)
    setLeavingGuest(false)
  }, [])

  useEffect(() => {
    auth.me().then(setUser, (err) => (err instanceof ApiError && err.status === 401 ? setUser(null) : setError(errorMessage(err))))
    const signedOut = () => setUser(null)
    window.addEventListener(SIGNED_OUT_EVENT, signedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, signedOut)
  }, [])

  const signOut = useCallback(() => {
    auth.signOut().finally(() => setUser(null))
  }, [])

  // What to show instead of the app while nobody (or a guest leaving guest mode) is signed in.
  const gate =
    error !== null ? (
      <p className="px-4 pt-24 text-center text-sm text-again-ink">{error}</p>
    ) : user === undefined ? null : !user ? (
      <SignIn onSignedIn={signedIn} />
    ) : leavingGuest ? (
      <SignIn onSignedIn={signedIn} onBack={() => setLeavingGuest(false)} />
    ) : undefined

  return (
    <BrowserRouter>
      <Routes>
        {/* Readable without signing in. */}
        <Route path="privacy" element={<Privacy />} />
        {gate !== undefined || !user ? (
          <Route path="*" element={gate} />
        ) : (
          <Route element={<Layout user={user} onSignOut={signOut} onCreateAccount={() => setLeavingGuest(true)} />}>
            <Route index element={<Review />} />
            <Route path="stats" element={<Stats />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  )
}
