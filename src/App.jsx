import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UserDetail from './pages/UserDetail'

function PrivateRoute({ children, isAdmin, ready }) {
  if (!ready) return null
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
    <BrowserRouter>
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
    </BrowserRouter>
  )
}

