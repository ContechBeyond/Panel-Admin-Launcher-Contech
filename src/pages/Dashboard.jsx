import { useState, useEffect } from 'react'
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { db, auth } from '../firebase'
import styles from './Dashboard.module.css'

function Avatar({ name }) {
  const letter = (name || '?')[0].toUpperCase()
  return <div className={styles.avatar}>{letter}</div>
}

function UserRow({ user, onUpdated, onDeleted, navigate }) {
  const [mode, setMode] = useState('view') // 'view' | 'edit' | 'confirmDelete'
  const [draftName, setDraftName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [rowError, setRowError] = useState('')

  const isAdmin = user.role === 'admin'

  const startEdit = (e) => {
    e.stopPropagation()
    setDraftName(user.name || '')
    setRowError('')
    setMode('edit')
  }

  const cancelEdit = (e) => {
    e?.stopPropagation()
    setMode('view')
  }

  const saveEdit = async (e) => {
    e.stopPropagation()
    const name = draftName.trim()
    if (!name) { setRowError('El nombre no puede estar vacío.'); return }
    setSaving(true)
    setRowError('')
    try {
      await updateDoc(doc(db, 'users', user.id), { name })
      onUpdated(user.id, { name })
      setMode('view')
    } catch (err) {
      setRowError('Error al guardar.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const startDelete = (e) => {
    e.stopPropagation()
    setMode('confirmDelete')
  }

  const cancelDelete = (e) => {
    e?.stopPropagation()
    setMode('view')
  }

  const doDelete = async (e) => {
    e.stopPropagation()
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'users', user.id))
      onDeleted(user.id)
    } catch (err) {
      console.error(err)
      setDeleting(false)
      setMode('view')
    }
  }

  if (mode === 'confirmDelete') {
    return (
      <tr className={`${styles.tr} ${styles.trDeleting}`}>
        <td colSpan={3} className={styles.td}>
          <span className={styles.deleteConfirmText}>
            ¿Eliminar a <strong>{user.name || user.id}</strong>?
          </span>
        </td>
        <td className={styles.td}>
          <div className={styles.actionBtns}>
            <button className={styles.deleteConfirmBtn} onClick={doDelete} disabled={deleting}>
              {deleting ? <span className={styles.microSpinner} /> : null}
              Eliminar
            </button>
            <button className={styles.cancelBtn} onClick={cancelDelete} disabled={deleting}>Cancelar</button>
          </div>
        </td>
      </tr>
    )
  }

  if (mode === 'edit') {
    return (
      <>
        <tr className={`${styles.tr} ${styles.trEditing}`}>
          <td className={styles.td}>
            <div className={styles.userCell}>
              <Avatar name={draftName || user.name} />
              <input
                className={styles.editInput}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          </td>
          <td className={styles.td}>
            <span className={`${styles.roleBadge} ${styles['role_' + (user.role || '').toLowerCase()]}`}>
              {user.role || '—'}
            </span>
            <span className={styles.roleLocked} title="El rol no se puede modificar">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          </td>
          <td className={`${styles.td} ${styles.uid}`}>{user.id}</td>
          <td className={styles.td}>
            <div className={styles.actionBtns}>
              <button className={styles.saveBtn} onClick={saveEdit} disabled={saving}>
                {saving ? <span className={styles.microSpinner} /> : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                Guardar
              </button>
              <button className={styles.cancelBtn} onClick={cancelEdit} disabled={saving}>Cancelar</button>
            </div>
          </td>
        </tr>
        {rowError && (
          <tr>
            <td colSpan={4} className={styles.saveErrorRow}>{rowError}</td>
          </tr>
        )}
      </>
    )
  }

  return (
    <tr
      className={`${styles.tr} ${styles.trClickable}`}
      onClick={() => navigate(`/dashboard/users/${user.id}`)}
    >
      <td className={styles.td}>
        <div className={styles.userCell}>
          <Avatar name={user.name} />
          <span className={styles.userName}>{user.name || '—'}</span>
        </div>
      </td>
      <td className={styles.td}>
        <span className={`${styles.roleBadge} ${styles['role_' + (user.role || '').toLowerCase()]}`}>
          {user.role || '—'}
        </span>
      </td>
      <td className={`${styles.td} ${styles.uid}`}>{user.id}</td>
      <td className={styles.td}>
        <div className={styles.actionBtns}>
          <button className={styles.editBtn} onClick={startEdit} title="Editar usuario">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Editar
          </button>
          <button
            className={`${styles.deleteBtn} ${isAdmin ? styles.deleteBtnDisabled : ''}`}
            onClick={isAdmin ? (e) => e.stopPropagation() : startDelete}
            disabled={isAdmin}
            title={isAdmin ? 'No se pueden eliminar administradores' : 'Eliminar usuario'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function Dashboard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'))
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        setError('No se pudo cargar la lista de usuarios. Verifica las reglas de Firestore.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  const handleUpdated = (userId, fields) => {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...fields } : u))
  }

  const handleDeleted = (userId) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId))
  }

  const filtered = users.filter((u) => {
    const term = search.toLowerCase()
    return (
      (u.name || '').toLowerCase().includes(term) ||
      (u.role || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <div className={styles.logoRing}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M12 2v20M2 7l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>
          <span className={styles.sidebarBrandName}>Contech</span>
        </div>

        <nav className={styles.nav}>
          <span className={styles.navLabel}>Menú</span>
          <a className={`${styles.navItem} ${styles.navItemActive}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Usuarios
          </a>
        </nav>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Cerrar sesión
        </button>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Usuarios</h1>
            <p className={styles.pageSubtitle}>Lista de usuarios registrados en la aplicación</p>
          </div>
          <div className={styles.headerBadge}>{users.length} registros</div>
        </header>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" />
              <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              className={styles.searchInput}
              placeholder="Buscar por nombre o rol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className={styles.stateBox}>
            <span className={styles.bigSpinner} />
            <p>Cargando usuarios...</p>
          </div>
        )}

        {error && !loading && (
          <div className={styles.errorBox}>{error}</div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Nombre</th>
                  <th className={styles.th}>Rol</th>
                  <th className={styles.th}>UID</th>
                  <th className={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.empty}>
                      {search ? 'Sin resultados para la búsqueda.' : 'No hay usuarios registrados.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onUpdated={handleUpdated}
                      onDeleted={handleDeleted}
                      navigate={navigate}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
