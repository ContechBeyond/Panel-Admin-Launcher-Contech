import { useState, useEffect } from 'react'
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, addDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useNavigate, useParams } from 'react-router-dom'
import { db, auth } from '../firebase'
import styles from './UserDetail.module.css'

const SECTIONS = [
  {
    key: 'apps',
    label: 'Aplicaciones Permitidas',
    allowAdd: true,
    addMode: 'app',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'contacts',
    label: 'Contactos',
    allowAdd: true,
    addMode: 'contact',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
]

function Avatar({ name }) {
  const letter = (name || '?')[0].toUpperCase()
  return <div className={styles.avatar}>{letter}</div>
}

function EditableRow({ userId, sectionKey, item, keys, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const startEdit = () => {
    const initial = {}
    keys.forEach((k) => { initial[k] = item[k] !== undefined && item[k] !== null ? String(item[k]) : '' })
    setDraft(initial)
    setSaveError('')
    setEditing(true)
  }

  const cancel = () => setEditing(false)

  const save = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const ref = doc(db, 'users', userId, sectionKey, item.id)
      await updateDoc(ref, draft)
      onSaved(item.id, draft)
      setEditing(false)
    } catch (err) {
      setSaveError('Error al guardar.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'users', userId, sectionKey, item.id))
      onDeleted(item.id)
    } catch (err) {
      console.error(err)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (confirmDelete) {
    return (
      <tr className={`${styles.tr} ${styles.trDeleting}`}>
        <td colSpan={keys.length + 1} className={styles.td}>
          <span className={styles.deleteConfirmText}>
            Eliminar <strong>{item.nombre || item.name || item.id}</strong>?
          </span>
        </td>
        <td className={styles.td}>
          <div className={styles.actionBtns}>
            <button className={styles.deleteConfirmBtn} onClick={handleDelete} disabled={deleting}>
              {deleting ? <span className={styles.microSpinner} /> : null}
              Eliminar
            </button>
            <button className={styles.cancelBtn} onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancelar</button>
          </div>
        </td>
      </tr>
    )
  }

  if (editing) {
    return (
      <>
        <tr className={`${styles.tr} ${styles.trEditing}`}>
          {keys.map((k) => (
            <td key={k} className={styles.td}>
              <input
                className={styles.editInput}
                value={draft[k] ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, [k]: e.target.value }))}
              />
            </td>
          ))}
          <td className={`${styles.td} ${styles.uid}`}>{item.id}</td>
          <td className={styles.td}>
            <div className={styles.actionBtns}>
              <button className={styles.saveBtn} onClick={save} disabled={saving}>
                {saving ? <span className={styles.microSpinner} /> : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                Guardar
              </button>
              <button className={styles.cancelBtn} onClick={cancel} disabled={saving}>Cancelar</button>
            </div>
          </td>
        </tr>
        {saveError && (
          <tr>
            <td colSpan={keys.length + 2} className={styles.saveErrorRow}>{saveError}</td>
          </tr>
        )}
      </>
    )
  }

  return (
    <tr className={styles.tr}>
      {keys.map((k) => (
        <td key={k} className={styles.td}>
          {item[k] !== undefined && item[k] !== null ? String(item[k]) : '—'}
        </td>
      ))}
      <td className={`${styles.td} ${styles.uid}`}>{item.id}</td>
      <td className={styles.td}>
        <div className={styles.actionBtns}>
          <button className={styles.editBtn} onClick={startEdit}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Editar
          </button>
          <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
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

function CollectionSection({ userId, sectionKey, label, icon, allowAdd, addMode }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPkg, setNewPkg] = useState('')
  const [newName, setNewName] = useState('')
  const [newContactName, setNewContactName] = useState('')
  const [newContactNumber, setNewContactNumber] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [bulkJson, setBulkJson] = useState('')
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkResult, setBulkResult] = useState('')
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  const toggle = async () => {
    if (!open && !fetched) {
      setLoading(true)
      try {
        const snap = await getDocs(collection(db, 'users', userId, sectionKey))
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setFetched(true)
      } catch (err) {
        setError('No se pudo cargar la subcoleccion.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    setOpen((v) => !v)
  }

  const handleSaved = (itemId, updatedFields) => {
    setItems((prev) => prev.map((it) => it.id === itemId ? { ...it, ...updatedFields } : it))
  }

  const handleDeleted = (itemId) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId))
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true)
    setAddError('')
    try {
      if (addMode === 'contact') {
        const name = newContactName.trim()
        const number = newContactNumber.trim()
        if (!name || !number) { setAddError('Completa ambos campos.'); setAdding(false); return }
        const colRef = collection(db, 'users', userId, sectionKey)
        const newDoc = await addDoc(colRef, { name, number })
        setItems((prev) => [...prev, { id: newDoc.id, name, number }])
        setNewContactName('')
        setNewContactNumber('')
      } else {
        const pkg = newPkg.trim()
        const nombre = newName.trim()
        if (!pkg || !nombre) { setAddError('Completa ambos campos.'); setAdding(false); return }
        if (items.some((it) => it.id === pkg)) { setAddError('Ese paquete ya existe.'); setAdding(false); return }
        const ref = doc(db, 'users', userId, sectionKey, pkg)
        await setDoc(ref, { nombre })
        setItems((prev) => [...prev, { id: pkg, nombre }])
        setNewPkg('')
        setNewName('')
      }
      setShowAddForm(false)
    } catch (err) {
      setAddError('Error al anadir.')
      console.error(err)
    } finally {
      setAdding(false)
    }
  }

  const handleBulkImport = async (e) => {
    e.preventDefault()
    setBulkError('')
    setBulkResult('')
    let parsed
    try {
      parsed = JSON.parse(bulkJson)
    } catch {
      setBulkError('JSON invalido. Verifica el formato.')
      return
    }
    if (!Array.isArray(parsed)) { setBulkError('El JSON debe ser un array [ ... ] de objetos.'); return }
    if (parsed.length === 0) { setBulkError('El array esta vacio.'); return }
    setBulkImporting(true)
    let added = 0, skipped = 0, errors = 0
    const newItems = []
    for (const item of parsed) {
      try {
        if (addMode === 'contact') {
          const name = String(item.name || '').trim()
          const number = String(item.number || '').trim()
          if (!name || !number) { skipped++; continue }
          const colRef = collection(db, 'users', userId, sectionKey)
          const newDoc = await addDoc(colRef, { name, number })
          newItems.push({ id: newDoc.id, name, number })
          added++
        } else {
          const pkg = String(item.package || item.id || '').trim()
          const nombre = String(item.nombre || item.name || '').trim()
          if (!pkg || !nombre) { skipped++; continue }
          if (items.some((it) => it.id === pkg) || newItems.some((it) => it.id === pkg)) { skipped++; continue }
          await setDoc(doc(db, 'users', userId, sectionKey, pkg), { nombre })
          newItems.push({ id: pkg, nombre })
          added++
        }
      } catch { errors++ }
    }
    setItems((prev) => [...prev, ...newItems])
    setBulkImporting(false)
    const parts = []
    if (added > 0) parts.push(`${added} importado${added !== 1 ? 's' : ''}`)
    if (skipped > 0) parts.push(`${skipped} omitido${skipped !== 1 ? 's' : ''}`)
    if (errors > 0) parts.push(`${errors} con error`)
    setBulkResult(parts.join(', '))
    if (added > 0) { setBulkJson(''); setShowBulkForm(false) }
  }

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try {
      await Promise.all(items.map((it) => deleteDoc(doc(db, 'users', userId, sectionKey, it.id))))
      setItems([])
      setConfirmDeleteAll(false)
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingAll(false)
    }
  }

  const keys = items.length > 0
    ? [...new Set(items.flatMap((item) => Object.keys(item).filter((k) => k !== 'id')))]
    : []

  return (
    <div className={`${styles.section} ${open ? styles.sectionOpen : ''}`}>
      <button className={styles.sectionHeader} onClick={toggle}>
        <span className={styles.sectionLeft}>
          <span className={styles.sectionIcon}>{icon}</span>
          <span className={styles.sectionLabel}>{label}</span>
          {fetched && <span className={styles.sectionCount}>{items.length}</span>}
        </span>
        <div className={styles.sectionRight}>
          {allowAdd && open && (
            <>
              <button
                className={styles.addBtn}
                onClick={(e) => { e.stopPropagation(); setShowAddForm((v) => !v); setShowBulkForm(false); setAddError('') }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                Anadir
              </button>
              <button
                className={styles.bulkBtn}
                onClick={(e) => { e.stopPropagation(); setShowBulkForm((v) => !v); setShowAddForm(false); setBulkError(''); setBulkResult('') }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="8" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                JSON
              </button>
              {items.length > 0 && !confirmDeleteAll && (
                <button
                  className={styles.deleteAllBtn}
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteAll(true); setShowAddForm(false); setShowBulkForm(false) }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Eliminar todo
                </button>
              )}
              {confirmDeleteAll && (
                <span className={styles.deleteAllConfirm}>
                  <span className={styles.deleteAllConfirmText}>¿Eliminar los {items.length}?</span>
                  <button
                    className={styles.deleteConfirmBtn}
                    onClick={(e) => { e.stopPropagation(); handleDeleteAll() }}
                    disabled={deletingAll}
                  >
                    {deletingAll ? <span className={styles.microSpinner} /> : null}
                    Sí
                  </button>
                  <button
                    className={styles.cancelBtn}
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteAll(false) }}
                    disabled={deletingAll}
                  >
                    No
                  </button>
                </span>
              )}
            </>
          )}
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </button>

      {open && (
        <div className={styles.sectionBody}>
          {allowAdd && showAddForm && (
            <form className={styles.addForm} onSubmit={handleAdd}>
              <div className={styles.addFormFields}>
                {addMode === 'contact' ? (
                  <>
                    <div className={styles.addField}>
                      <label className={styles.addLabel}>Nombre</label>
                      <input
                        className={styles.addInput}
                        placeholder="Nombre del contacto"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        disabled={adding}
                      />
                    </div>
                    <div className={styles.addField}>
                      <label className={styles.addLabel}>Numero</label>
                      <input
                        className={styles.addInput}
                        placeholder="+1234567890"
                        value={newContactNumber}
                        onChange={(e) => setNewContactNumber(e.target.value)}
                        disabled={adding}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.addField}>
                      <label className={styles.addLabel}>Nombre de paquete</label>
                      <input
                        className={styles.addInput}
                        placeholder="com.ejemplo.app"
                        value={newPkg}
                        onChange={(e) => setNewPkg(e.target.value)}
                        disabled={adding}
                      />
                    </div>
                    <div className={styles.addField}>
                      <label className={styles.addLabel}>Nombre de la app</label>
                      <input
                        className={styles.addInput}
                        placeholder="Mi Aplicacion"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        disabled={adding}
                      />
                    </div>
                  </>
                )}
              </div>
              {addError && <p className={styles.addError}>{addError}</p>}
              <div className={styles.addFormActions}>
                <button type="submit" className={styles.saveBtn} disabled={adding}>
                  {adding ? <span className={styles.microSpinner} /> : null}
                  {addMode === 'contact' ? 'Anadir contacto' : 'Anadir aplicacion'}
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => { setShowAddForm(false); setAddError('') }}
                  disabled={adding}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {allowAdd && showBulkForm && (
            <form className={styles.bulkForm} onSubmit={handleBulkImport}>
              <div className={styles.bulkHeader}>
                <span className={styles.bulkTitle}>Importar desde JSON</span>
                <span className={styles.bulkHint}>
                  {addMode === 'contact'
                    ? '[{"name": "Juan", "number": "+52..."}, ...]'
                    : '[{"package": "com.ejemplo", "nombre": "Mi App"}, ...]'}
                </span>
              </div>
              <textarea
                className={styles.bulkTextarea}
                placeholder="Pega el JSON aqui..."
                value={bulkJson}
                onChange={(e) => setBulkJson(e.target.value)}
                disabled={bulkImporting}
                rows={6}
              />
              {bulkError && <p className={styles.addError}>{bulkError}</p>}
              {bulkResult && <p className={styles.bulkResult}>{bulkResult}</p>}
              <div className={styles.addFormActions}>
                <button type="submit" className={styles.saveBtn} disabled={bulkImporting}>
                  {bulkImporting ? <span className={styles.microSpinner} /> : null}
                  Importar
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => { setShowBulkForm(false); setBulkError(''); setBulkResult(''); setBulkJson('') }}
                  disabled={bulkImporting}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {loading && (
            <div className={styles.loadingRow}>
              <span className={styles.smallSpinner} />
              Cargando...
            </div>
          )}
          {error && <div className={styles.errorRow}>{error}</div>}
          {!loading && !error && items.length === 0 && (
            <div className={styles.emptyRow}>Sin registros en esta seccion.</div>
          )}
          {!loading && !error && items.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {keys.map((k) => (
                      <th key={k} className={styles.th}>{k}</th>
                    ))}
                    <th className={styles.th}>ID</th>
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <EditableRow
                      key={item.id}
                      userId={userId}
                      sectionKey={sectionKey}
                      item={item}
                      keys={keys}
                      onSaved={handleSaved}
                      onDeleted={handleDeleted}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function UserDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDoc(doc(db, 'users', userId))
      .then((snap) => {
        if (snap.exists()) setUser({ id: snap.id, ...snap.data() })
      })
      .finally(() => setLoading(false))
  }, [userId])

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.layout}>
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
          <span className={styles.navLabel}>Menu</span>
          <a className={styles.navItem} onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
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
          Cerrar sesion
        </button>
      </aside>

      <main className={styles.main}>
        <div className={styles.breadcrumb}>
          <button className={styles.breadcrumbBack} onClick={() => navigate('/dashboard')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className={styles.breadcrumbItem} onClick={() => navigate('/dashboard')}>Usuarios</span>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{loading ? '...' : (user?.name || userId)}</span>
        </div>

        {loading ? (
          <div className={styles.stateBox}>
            <span className={styles.bigSpinner} />
          </div>
        ) : !user ? (
          <div className={styles.errorBox}>Usuario no encontrado.</div>
        ) : (
          <>
            <div className={styles.userCard}>
              <Avatar name={user.name} />
              <div className={styles.userInfo}>
                <h1 className={styles.userName}>{user.name || '—'}</h1>
                <p className={styles.userUid}>{user.id}</p>
              </div>
              <span className={`${styles.roleBadge} ${styles['role_' + (user.role || '').toLowerCase()]}`}>
                {user.role || '—'}
              </span>
            </div>

            <div className={styles.sections}>
              {SECTIONS.map((s) => (
                <CollectionSection
                  key={s.key}
                  userId={userId}
                  sectionKey={s.key}
                  label={s.label}
                  icon={s.icon}
                  allowAdd={s.allowAdd}
                  addMode={s.addMode}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
