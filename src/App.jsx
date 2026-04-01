import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UserDetail from './pages/UserDetail'

function PrivateRoute({ children, isAdmin, ready }) {
  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0d0d0d' }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#c0392b', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  return isAdmin ? children : <Navigate to="/login" replace />
}

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setIsAdmin(false)
        setReady(true)
        return
      }
      try {
        const snap = await getDoc(doc(db, 'users', u.uid))
        if (snap.exists() && snap.data().role === 'admin') {
          setIsAdmin(true)
        } else {
          setIsAdmin(false)
          await signOut(auth)
          // Forzar redirect con mensaje — guardado en sessionStorage para sobrevivir el signOut
          sessionStorage.setItem('authError', 'No tienes permisos para acceder al panel de administración.')
        }
      } catch {
        setIsAdmin(false)
        await signOut(auth)
        sessionStorage.setItem('authError', 'No se pudo verificar tu cuenta. Intenta de nuevo.')
      } finally {
        setReady(true)
      }
    })
    return unsub
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/login"
          element={ready && isAdmin ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute isAdmin={isAdmin} ready={ready}>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/users/:userId"
          element={
            <PrivateRoute isAdmin={isAdmin} ready={ready}>
              <UserDetail />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  )
}

