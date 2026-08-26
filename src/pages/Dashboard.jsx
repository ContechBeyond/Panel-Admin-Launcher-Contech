import { useState, useEffect, useRef } from 'react'
import { collection, getDocs, doc, updateDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove, query, orderBy, where, limit, startAfter, documentId } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { db, auth } from '../firebase'
import { phoneKey } from '../utils/phone'
import styles from './Dashboard.module.css'

// Genera tokens de búsqueda: todas las subcadenas >= 2 chars de cada segmento
function generateSearchTokens(name) {
  if (!name) return []
  const tokens = new Set()
  name.toLowerCase().split(/[\s.@_\-/\\+,;:]+/).filter(Boolean).forEach((part) => {
    for (let i = 0; i < part.length - 1; i++) {
      for (let j = i + 2; j <= part.length; j++) {
        tokens.add(part.substring(i, j))
      }
    }
  })
  return [...tokens]
}

// Filtra por nombre exigiendo todas las palabras del término (búsquedas multi-palabra)
function matchesAllWords(name, words) {
  const n = (name || '').toLowerCase()
  return words.every((w) => n.includes(w))
}

function Avatar({ name }) {
  const letter = (name || '?')[0].toUpperCase()
  return <div className={styles.avatar}>{letter}</div>
}

function UserRow({ user, onUpdated, onDeleted, navigate, selectionMode, selected, onToggleSelect }) {
  const [mode, setMode] = useState('view')
  const [draftName, setDraftName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [rowError, setRowError] = useState('')

  const isAdmin = user.role === 'admin'

  const handleRowClick = () => {
    if (selectionMode) { onToggleSelect(user); return }
    navigate(`/dashboard/users/${user.id}`, { state: { user } })
  }

  const startEdit = (e) => { e.stopPropagation(); setDraftName(user.name || ''); setRowError(''); setMode('edit') }
  const cancelEdit = (e) => { e?.stopPropagation(); setMode('view') }

  const saveEdit = async (e) => {
    e.stopPropagation()
    const name = draftName.trim()
    if (!name) { setRowError('El nombre no puede estar vacio.'); return }
    setSaving(true); setRowError('')
    try {
      const searchTokens = generateSearchTokens(name)
      await updateDoc(doc(db, 'users', user.id), { name, searchTokens })
      onUpdated(user.id, { name, searchTokens }); setMode('view')
    } catch (err) { setRowError('Error al guardar.'); console.error(err) }
    finally { setSaving(false) }
  }

  const startDelete = (e) => { e.stopPropagation(); setMode('confirmDelete') }
  const cancelDelete = (e) => { e?.stopPropagation(); setMode('view') }

  const doDelete = async (e) => {
    e.stopPropagation(); setDeleting(true)
    try { await deleteDoc(doc(db, 'users', user.id)); onDeleted(user.id) }
    catch (err) { console.error(err); setDeleting(false); setMode('view') }
  }

  if (mode === 'confirmDelete') {
    return (
      <tr className={`${styles.tr} ${styles.trDeleting}`}>
        <td colSpan={selectionMode ? 4 : 3} className={styles.td}>
          <span className={styles.deleteConfirmText}>
            Eliminar a <strong>{user.name || user.id}</strong>?
          </span>
        </td>
        <td className={styles.td}>
          <div className={styles.actionBtns}>
            <button className={styles.deleteConfirmBtn} onClick={doDelete} disabled={deleting}>
              {deleting ? <span className={styles.microSpinner} /> : null}Eliminar
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
          {selectionMode && <td className={styles.td} />}
          <td className={styles.td}>
            <div className={styles.userCell}>
              <Avatar name={draftName || user.name} />
              <input className={styles.editInput} value={draftName} onChange={(e) => setDraftName(e.target.value)} onClick={(e) => e.stopPropagation()} autoFocus />
            </div>
          </td>
          <td className={styles.td}>
            <span className={`${styles.roleBadge} ${styles['role_' + (user.role || '').toLowerCase()]}`}>{user.role || '-'}</span>
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
        {rowError && <tr><td colSpan={selectionMode ? 5 : 4} className={styles.saveErrorRow}>{rowError}</td></tr>}
      </>
    )
  }

  return (
    <tr
      className={`${styles.tr} ${styles.trClickable} ${selected ? styles.trSelected : ''}`}
      onClick={handleRowClick}
    >
      {selectionMode && (
        <td className={styles.tdCheck} onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" className={styles.checkbox} checked={selected} onChange={() => onToggleSelect(user)} />
        </td>
      )}
      <td className={styles.td}>
        <div className={styles.userCell}>
          <Avatar name={user.name} />
          <span className={styles.userName}>{user.name || '-'}</span>
        </div>
      </td>
      <td className={styles.td}>
        <span className={`${styles.roleBadge} ${styles['role_' + (user.role || '').toLowerCase()]}`}>{user.role || '-'}</span>
      </td>
      <td className={`${styles.td} ${styles.uid}`}>{user.id}</td>
      <td className={styles.td}>
        <div className={styles.actionBtns}>
          <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); startEdit(e) }} title="Editar usuario">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Editar
          </button>
          <button
            className={`${styles.deleteBtn} ${isAdmin ? styles.deleteBtnDisabled : ''}`}
            onClick={isAdmin ? (e) => e.stopPropagation() : (e) => { e.stopPropagation(); startDelete(e) }}
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

// Modal para operaciones masivas
function BulkModal({ action, selectedCount, onConfirm, onClose }) {
  const [jsonInput, setJsonInput] = useState('')
  const [singlePkg, setSinglePkg] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [report, setReport] = useState(null)

  const isApp = action === 'addApp' || action === 'removeApp'
  const isAdd = action === 'addApp' || action === 'addContact'
  const titles = { addApp: 'Agregar apps', removeApp: 'Quitar app', addContact: 'Agregar contactos', removeContact: 'Quitar contacto' }

  const parseAndValidate = () => {
    setJsonError('')
    if (isAdd) {
      let parsed
      try { parsed = JSON.parse(jsonInput) } catch { setJsonError('JSON invalido. Revisa la sintaxis.'); return null }
      if (!Array.isArray(parsed) || parsed.length === 0) { setJsonError('Debe ser un array no vacio: [ ... ]'); return null }
      if (isApp) {
        if (!parsed.every((x) => typeof x === 'string' && x.trim())) { setJsonError('Cada elemento debe ser un string (package name).'); return null }
        return parsed.map((x) => x.trim())
      } else {
        if (!parsed.every((x) => x && typeof x.name === 'string' && typeof x.number === 'string' && x.name.trim() && x.number.trim())) {
          setJsonError('Cada objeto debe tener "name" y "number" como strings no vacios.')
          return null
        }
        return parsed.map((x) => ({ name: x.name.trim(), number: x.number.trim() }))
      }
    } else {
      if (isApp) {
        if (!singlePkg.trim()) { setJsonError('Ingresa el package name.'); return null }
        return singlePkg.trim()
      } else {
        if (!contactName.trim() || !contactNumber.trim()) { setJsonError('Ingresa nombre y numero.'); return null }
        return { name: contactName.trim(), number: contactNumber.trim() }
      }
    }
  }

  const handleSubmit = async () => {
    const payload = parseAndValidate()
    if (payload === null) return
    setLoading(true)
    setResult(null)
    try {
      const res = await onConfirm(action, payload)
      setReport(res || null)
      setResult('ok')
    } catch {
      setResult('error')
    } finally {
      setLoading(false)
    }
  }

  const exampleApp = `[\n  "com.whatsapp",\n  "com.spotify",\n  "com.example.app"\n]`
  const exampleContact = `[\n  { "name": "Soporte", "number": "+521234567890" },\n  { "name": "Ventas", "number": "+529876543210" }\n]`
  const example = isApp ? exampleApp : exampleContact
  const [copied, setCopied] = useState(false)
  const handleCopyFormat = () => {
    navigator.clipboard.writeText(example)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>{titles[action]}</h3>
        <p className={styles.modalSubtitle}>
          Se aplicara a <strong>{selectedCount}</strong> usuario{selectedCount !== 1 ? 's' : ''}.
          {!isAdd && ' Si algun usuario no tiene el elemento, se omitira sin error.'}
          {isAdd && action === 'addContact' && ' Los numeros duplicados no se agregan (se comparan los ultimos 10 digitos; el nombre no importa).'}
          {isAdd && action === 'addApp' && ' Si algun usuario ya lo tiene, no se duplicara.'}
        </p>
        {isAdd ? (
          <>
            <textarea
              className={styles.modalTextarea}
              placeholder={isApp ? exampleApp : exampleContact}
              value={jsonInput}
              onChange={(e) => { setJsonInput(e.target.value); setJsonError('') }}
              autoFocus
              spellCheck={false}
            />
            <div className={styles.modalHintRow}>
              <p className={styles.modalHint}>
                {isApp ? 'Array JSON de package names.' : 'Array JSON de objetos con "name" y "number".'}
              </p>
              <button className={styles.copyFormatBtn} onClick={handleCopyFormat} type="button">
                {copied ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
                {copied ? 'Copiado' : 'Copiar formato'}
              </button>
            </div>
          </>
        ) : isApp ? (
          <input
            className={styles.modalInput}
            placeholder="Package name (ej: com.whatsapp)"
            value={singlePkg}
            onChange={(e) => setSinglePkg(e.target.value)}
            autoFocus
          />
        ) : (
          <>
            <input className={styles.modalInput} placeholder="Nombre del contacto" value={contactName} onChange={(e) => setContactName(e.target.value)} autoFocus />
            <input className={styles.modalInput} placeholder="Numero (ej: +521234567890)" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} style={{ marginTop: '0.6rem' }} />
          </>
        )}
        {jsonError && <p className={styles.modalError}>{jsonError}</p>}
        {result === 'ok' && (
          action === 'addContact' && report ? (
            <p className={report.usersWritten === 0 ? styles.modalError : styles.modalSuccess}>
              {report.usersWritten === 0
                ? 'Ningun contacto agregado: todos los usuarios seleccionados ya tenian ese numero (duplicado).'
                : `Contactos agregados en ${report.usersWritten} usuario${report.usersWritten !== 1 ? 's' : ''}.`}
              {report.dupSkipped > 0 && ` ${report.dupSkipped} omitido${report.dupSkipped !== 1 ? 's' : ''} por numero duplicado.`}
            </p>
          ) : (
            <p className={styles.modalSuccess}>Operacion completada en {selectedCount} usuarios.</p>
          )
        )}
        {result === 'error' && <p className={styles.modalError}>Ocurrio un error. Revisa la consola.</p>}
        <div className={styles.modalActions}>
          {result !== 'ok' && (
            <button className={styles.modalConfirmBtn} onClick={handleSubmit} disabled={loading}>
              {loading ? <span className={styles.microSpinner} /> : null}
              {loading ? 'Aplicando...' : 'Confirmar'}
            </button>
          )}
          <button className={styles.modalCancelBtn} onClick={onClose} disabled={loading}>
            {result === 'ok' ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const USERS_CACHE_KEY = 'dashboard_users_cache'
const USERS_CACHE_TTL = 5 * 60 * 1000
const PAGE_SIZE = 20
const LOAD_ALL_CHUNK = 500

// ponytail: sessionStorage tiene ~5MB; con listas grandes setItem lanza QuotaExceededError.
// Cachear es una optimizacion, no un requisito: si no cabe, se borra la cache y se sigue.
// Techo: listas grandes dejan de cachearse (se relee Firebase al volver de un detalle).
const writeUsersCache = (data, hasMore, lastId) => {
  try {
    sessionStorage.setItem(USERS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data, hasMore, lastId }))
  } catch {
    sessionStorage.removeItem(USERS_CACHE_KEY)
  }
}
const BATCH_SIZE = 499

export default function Dashboard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const lastIdRef = useRef(null)

  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchHasMore, setSearchHasMore] = useState(false)
  const [searchActive, setSearchActive] = useState(false) // true cuando se ha buscado al menos una vez
  const lastSearchDocRef = useRef(null)
  const searchTermRef = useRef('')
  const searchWordsRef = useRef([])

  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)
  const [reindexing, setReindexing] = useState(false)

  // Seleccion masiva
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectedUsers, setSelectedUsers] = useState(new Map()) // id -> user obj (cache p/ mostrar nombres de seleccionados invisibles)
  const [selectedFilter, setSelectedFilter] = useState('')
  const [companyInput, setCompanyInput] = useState('')
  const [companyLoading, setCompanyLoading] = useState(false)
  const [bulkAction, setBulkAction] = useState(null)

  const navigate = useNavigate()

  // Restaura lista cacheada al montar → evita relecturas de Firebase al volver de un detalle
  useEffect(() => {
    const raw = sessionStorage.getItem(USERS_CACHE_KEY)
    if (!raw) return
    try {
      const cached = JSON.parse(raw)
      if (!cached || Date.now() - cached.ts > USERS_CACHE_TTL) { sessionStorage.removeItem(USERS_CACHE_KEY); return }
      setUsers(cached.data || [])
      setHasMore(!!cached.hasMore)
      lastIdRef.current = cached.lastId || null
    } catch { sessionStorage.removeItem(USERS_CACHE_KEY) }
  }, [])

  const isSearchMode = searchActive
  const displayUsers = isSearchMode ? searchResults : users
  const displayLoading = isSearchMode ? searchLoading : (loading || loadingAll)
  const displayHasMore = isSearchMode ? searchHasMore : hasMore

  const handleLoadFirst = async () => {
    sessionStorage.removeItem(USERS_CACHE_KEY)
    setLoading(true); setError(''); lastIdRef.current = null
    try {
      const q = query(collection(db, 'users'), orderBy(documentId()), limit(PAGE_SIZE))
      const snap = await getDocs(q)
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const more = snap.docs.length === PAGE_SIZE
      const lastId = snap.docs[snap.docs.length - 1]?.id || null
      lastIdRef.current = lastId; setUsers(data); setHasMore(more)
      writeUsersCache(data, more, lastId)
    } catch (err) { setError('No se pudo cargar la lista de usuarios.'); console.error(err) }
    finally { setLoading(false) }
  }

  const handleLoadAll = async () => {
    setLoadingAll(true); setError(''); lastIdRef.current = null
    let all = []
    try {
      let lastDoc = null; let morePages = true
      while (morePages) {
        const q = lastDoc
          ? query(collection(db, 'users'), orderBy(documentId()), startAfter(lastDoc), limit(LOAD_ALL_CHUNK))
          : query(collection(db, 'users'), orderBy(documentId()), limit(LOAD_ALL_CHUNK))
        const snap = await getDocs(q)
        all = [...all, ...snap.docs.map((d) => ({ id: d.id, ...d.data() }))]
        morePages = snap.docs.length === LOAD_ALL_CHUNK
        lastDoc = snap.docs[snap.docs.length - 1] || null
      }
      lastIdRef.current = null; setUsers(all); setHasMore(false)
      writeUsersCache(all, false, null)
    } catch (err) { setError('Error al cargar todos los usuarios.'); console.error(err) }
    finally { setLoadingAll(false) }
  }

  const handleSearch = async () => {
    const words = search.trim().toLowerCase().split(/\s+/).filter((w) => w.length >= 2)
    if (words.length === 0) return
    // Consulta por la palabra más larga (es un token indexado) y filtra el resto en cliente.
    // ponytail: multi-palabra depende de que cada palabra sea un segmento tokenizado + filtro cliente;
    // una página puede mostrar <20 coincidencias aunque haya más en servidor. Suficiente para el panel.
    const queryToken = words.reduce((a, b) => (b.length > a.length ? b : a))
    searchTermRef.current = queryToken; searchWordsRef.current = words
    setSearchActive(true); setSearchLoading(true); setSearchHasMore(false); lastSearchDocRef.current = null; setError('')
    try {
      const q = query(collection(db, 'users'), where('searchTokens', 'array-contains', queryToken), limit(PAGE_SIZE))
      const snap = await getDocs(q)
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => matchesAllWords(u.name, words))
      lastSearchDocRef.current = snap.docs[snap.docs.length - 1] || null
      setSearchResults(data); setSearchHasMore(snap.docs.length === PAGE_SIZE)
    } catch (err) { setError('Error al buscar. Intenta de nuevo.'); console.error(err) }
    finally { setSearchLoading(false) }
  }

  const handleClearSearch = () => {
    setSearch(''); setSearchActive(false); setSearchResults([]); setSearchHasMore(false); lastSearchDocRef.current = null; setError('')
  }

  const handleLoadMore = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      if (isSearchMode) {
        if (!lastSearchDocRef.current) return
        const q = query(collection(db, 'users'), where('searchTokens', 'array-contains', searchTermRef.current), startAfter(lastSearchDocRef.current), limit(PAGE_SIZE))
        const snap = await getDocs(q)
        const newData = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => matchesAllWords(u.name, searchWordsRef.current))
        lastSearchDocRef.current = snap.docs[snap.docs.length - 1] || null
        setSearchResults((prev) => [...prev, ...newData]); setSearchHasMore(snap.docs.length === PAGE_SIZE)
      } else {
        if (!lastIdRef.current) return
        const q = query(collection(db, 'users'), orderBy(documentId()), startAfter(lastIdRef.current), limit(PAGE_SIZE))
        const snap = await getDocs(q)
        const newData = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const more = snap.docs.length === PAGE_SIZE
        const lastId = snap.docs[snap.docs.length - 1]?.id || null
        lastIdRef.current = lastId
        setUsers((prev) => {
          const updated = [...prev, ...newData]
          writeUsersCache(updated, more, lastId)
          return updated
        }); setHasMore(more)
      }
    } catch (err) { console.error(err) }
    finally { setLoadingMore(false) }
  }

  const handleRefresh = () => {
    sessionStorage.removeItem(USERS_CACHE_KEY)
    handleClearSearch()
    setUsers([]); setHasMore(false); lastIdRef.current = null; setError('')
  }

  const handleReindex = async () => {
    setReindexing(true)
    try {
      let lastDoc = null; let hasMoreDocs = true
      while (hasMoreDocs) {
        const q = lastDoc
          ? query(collection(db, 'users'), orderBy(documentId()), startAfter(lastDoc), limit(50))
          : query(collection(db, 'users'), orderBy(documentId()), limit(50))
        const snap = await getDocs(q)
        await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { searchTokens: generateSearchTokens(d.data().name) })))
        hasMoreDocs = snap.docs.length === 50
        lastDoc = snap.docs[snap.docs.length - 1] || null
      }
      sessionStorage.removeItem(USERS_CACHE_KEY)
      setUsers([]); setHasMore(false); lastIdRef.current = null
    } catch (err) { console.error(err) }
    finally { setReindexing(false) }
  }

  const handleLogout = async () => { await signOut(auth); navigate('/login', { replace: true }) }

  const handleUpdated = (userId, fields) => {
    setUsers((prev) => {
      const updated = prev.map((u) => u.id === userId ? { ...u, ...fields } : u)
      writeUsersCache(updated, hasMore, lastIdRef.current)
      return updated
    })
    setSearchResults((prev) => prev.map((u) => u.id === userId ? { ...u, ...fields } : u))
  }

  const handleDeleted = (userId) => {
    setUsers((prev) => {
      const updated = prev.filter((u) => u.id !== userId)
      writeUsersCache(updated, hasMore, lastIdRef.current)
      return updated
    })
    setSearchResults((prev) => prev.filter((u) => u.id !== userId))
  }

  // === Seleccion masiva ===
  const toggleSelectionMode = () => {
    setSelectionMode((v) => { if (v) { setSelectedIds(new Set()); setSelectedUsers(new Map()) } return !v })
    setCompanyInput(''); setSelectedFilter('')
  }

  const handleToggleSelect = (user) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(user.id) ? next.delete(user.id) : next.add(user.id); return next })
    setSelectedUsers((prev) => { const m = new Map(prev); m.set(user.id, user); return m })
  }

  const handleSelectVisible = () => {
    setSelectedIds((prev) => { const next = new Set(prev); displayUsers.forEach((u) => next.add(u.id)); return next })
    setSelectedUsers((prev) => { const m = new Map(prev); displayUsers.forEach((u) => m.set(u.id, u)); return m })
  }

  const handleDeselectAll = () => { setSelectedIds(new Set()); setSelectedUsers(new Map()) }

  const handleDeselectOne = (id) => setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next })

  const handleSelectByCompany = async () => {
    const company = companyInput.trim().toLowerCase()
    if (!company) return
    setCompanyLoading(true)
    try {
      const ids = new Set(selectedIds)
      const objs = new Map(selectedUsers)
      let lastDoc = null; let morePages = true
      while (morePages) {
        const q = lastDoc
          ? query(collection(db, 'users'), where('searchTokens', 'array-contains', company), startAfter(lastDoc), limit(200))
          : query(collection(db, 'users'), where('searchTokens', 'array-contains', company), limit(200))
        const snap = await getDocs(q)
        snap.docs.forEach((d) => { ids.add(d.id); objs.set(d.id, { id: d.id, ...d.data() }) })
        morePages = snap.docs.length === 200
        lastDoc = snap.docs[snap.docs.length - 1] || null
      }
      setSelectedIds(ids); setSelectedUsers(objs)
    } catch (err) { console.error(err) }
    finally { setCompanyLoading(false) }
  }

  const handleBulkConfirm = async (action, payload) => {
    const ids = [...selectedIds]
    const isAdd = action === 'addApp' || action === 'addContact'
    const field = action === 'addApp' || action === 'removeApp' ? 'apps' : 'contacts'

    // === addContact: dedup por numero (ultimos 10 digitos) SIN lecturas extra ===
    // Los contactos actuales ya estan en `selectedUsers` (cacheados al seleccionar), asi que
    // calculamos por usuario que numeros faltan. Usuario 100% duplicado => no se escribe (menos escrituras).
    // El nombre no importa: solo cuenta el numero. `contactAdds`: id -> contactos nuevos a agregar.
    const contactAdds = new Map()
    let dupSkipped = 0
    if (action === 'addContact') {
      for (const id of ids) {
        const existing = selectedUsers.get(id)?.contacts || []
        const seen = new Set(existing.map((c) => phoneKey(c.number)))
        const toAdd = []
        for (const c of payload) {
          const k = phoneKey(c.number)
          if (k && seen.has(k)) { dupSkipped++; continue }
          seen.add(k); toAdd.push(c)
        }
        if (toAdd.length) contactAdds.set(id, toAdd)
      }
    }

    // Solo escribimos en usuarios que realmente cambian.
    // payload is an array when adding (spread into arrayUnion), single item when removing.
    // ponytail: arrayRemove(objeto) exige match exacto (name+number). Un match manual costaría
    // 1 lectura por doc (mata la cuota gratis), así que se mantiene: el input debe coincidir tal cual.
    const writeIds = action === 'addContact' ? [...contactAdds.keys()] : ids
    for (let i = 0; i < writeIds.length; i += BATCH_SIZE) {
      const batch = writeBatch(db)
      writeIds.slice(i, i + BATCH_SIZE).forEach((id) => {
        const fieldValue = action === 'addContact'
          ? arrayUnion(...contactAdds.get(id))
          : isAdd ? arrayUnion(...payload) : arrayRemove(payload)
        batch.update(doc(db, 'users', id), { [field]: fieldValue })
      })
      await batch.commit()
    }

    // Espejo local de arrayUnion/arrayRemove → lista y cache al día sin relecturas
    const applyLocal = (u) => {
      const arr = u[field] || []
      if (action === 'addContact') return { ...u, contacts: [...arr, ...(contactAdds.get(u.id) || [])] }
      const next = isAdd
        ? [...arr, ...payload.filter((p) => !arr.some((x) => JSON.stringify(x) === JSON.stringify(p)))]
        : arr.filter((x) => JSON.stringify(x) !== JSON.stringify(payload))
      return { ...u, [field]: next }
    }
    setUsers((prev) => {
      const updated = prev.map((u) => selectedIds.has(u.id) ? applyLocal(u) : u)
      writeUsersCache(updated, hasMore, lastIdRef.current)
      return updated
    })
    setSearchResults((prev) => prev.map((u) => selectedIds.has(u.id) ? applyLocal(u) : u))
    // Mantener cache de seleccionados al dia para evitar re-agregar si se confirma otra vez
    setSelectedUsers((prev) => {
      const m = new Map(prev)
      selectedIds.forEach((id) => { const u = m.get(id); if (u) m.set(id, applyLocal(u)) })
      return m
    })

    return { total: ids.length, usersWritten: writeIds.length, dupSkipped }
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
          <a className={`${styles.navItem} ${styles.navItemActive}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Usuarios
          </a>
          <span className={styles.navLabel} style={{ marginTop: '1rem' }}>Descargas</span>
          <a
            className={styles.navItem}
            href="https://firebasestorage.googleapis.com/v0/b/launcher-contech.firebasestorage.app/o/Launcher%20Contech.apk?alt=media"
            download="Launcher Contech.apk"
            target="_blank"
            rel="noreferrer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Launcher Contech
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
        <header className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Usuarios</h1>
            <p className={styles.pageSubtitle}>Lista de usuarios registrados en la aplicacion</p>
          </div>
          <div className={styles.headerBadge}>
            {selectionMode
              ? `${selectedIds.size} seleccionado${selectedIds.size !== 1 ? 's' : ''}`
              : isSearchMode
                ? `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''}`
                : users.length > 0
                  ? `${users.length} cargados${hasMore ? '+' : ''}`
                  : 'Sin cargar'}
          </div>
        </header>

        {/* Toolbar normal */}
        {!selectionMode && (
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" />
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                className={styles.searchInput}
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              {(search || searchActive) && (
                <button className={styles.searchClear} onClick={handleClearSearch} title="Limpiar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
            <button className={styles.searchBtn} onClick={handleSearch} disabled={searchLoading || !search.trim()} title="Buscar">
              {searchLoading ? <span className={styles.microSpinner} /> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
              Buscar
            </button>
            <button className={styles.refreshBtn} onClick={handleRefresh} disabled={loading || loadingAll} title="Limpiar y resetear">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={loading ? { animation: 'spin 0.8s linear infinite' } : {}}>
                <path d="M23 4v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1 20v-6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Actualizar
            </button>
            {/* Boton "Indexar busqueda" oculto: evita escrituras innecesarias. handleReindex se conserva por si se necesita reactivar.
            <button className={styles.reindexBtn} onClick={handleReindex} disabled={reindexing} title="Indexar busqueda">
              {reindexing ? <span className={styles.microSpinner} /> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {reindexing ? 'Indexando...' : 'Indexar busqueda'}
            </button>
            */}
            <button className={styles.selectModeBtn} onClick={toggleSelectionMode} title="Seleccionar usuarios para operaciones masivas">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Seleccionar
            </button>
          </div>
        )}

        {/* Toolbar seleccion */}
        {selectionMode && (
          <div className={styles.selectionToolbar}>
            <div className={styles.selectionToolbarLeft}>
              <button className={styles.selectVisibleBtn} onClick={handleSelectVisible}>Seleccionar visibles</button>
              <button className={styles.deselectBtn} onClick={handleDeselectAll}>Deseleccionar todo</button>
              <div className={styles.companySelectWrap}>
                <input
                  className={styles.companyInput}
                  placeholder="Empresa (ej: femsa)"
                  value={companyInput}
                  onChange={(e) => setCompanyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectByCompany()}
                />
                <button className={styles.companySelectBtn} onClick={handleSelectByCompany} disabled={companyLoading || !companyInput.trim()}>
                  {companyLoading ? <span className={styles.microSpinner} /> : 'Seleccionar empresa'}
                </button>
              </div>
            </div>
            <button className={styles.exitSelectionBtn} onClick={toggleSelectionMode}>Cancelar</button>
          </div>
        )}

        {/* Lista de seleccionados: revisar y desmarcar antes de la operacion masiva */}
        {selectionMode && selectedIds.size > 0 && (
          <div className={styles.selectedPanel}>
            <div className={styles.selectedPanelHead}>
              <span className={styles.selectedPanelTitle}>
                {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''} — revisa y desmarca los que no quieras modificar
              </span>
              {selectedIds.size > 8 && (
                <input
                  className={styles.selectedFilterInput}
                  placeholder="Filtrar seleccionados..."
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                />
              )}
            </div>
            <div className={styles.selectedChips}>
              {[...selectedIds]
                .map((id) => selectedUsers.get(id) || { id, name: id })
                .filter((u) => { const f = selectedFilter.trim().toLowerCase(); return !f || (u.name || u.id).toLowerCase().includes(f) })
                .map((u) => (
                  <span key={u.id} className={styles.selectedChip}>
                    <span className={styles.selectedChipName}>{u.name || u.id}</span>
                    <button className={styles.selectedChipRemove} onClick={() => handleDeselectOne(u.id)} title="Quitar de la seleccion">×</button>
                  </span>
                ))}
            </div>
          </div>
        )}

        {displayLoading && (
          <div className={styles.stateBox}>
            <span className={styles.bigSpinner} />
            <p>{isSearchMode ? 'Buscando...' : loadingAll ? 'Cargando todos...' : 'Cargando usuarios...'}</p>
          </div>
        )}

        {error && !displayLoading && <div className={styles.errorBox}>{error}</div>}

        {!displayLoading && !error && !isSearchMode && users.length === 0 && (
          <div className={styles.emptyStart}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className={styles.emptyStartIcon}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className={styles.emptyStartText}>No hay usuarios cargados</p>
            <div className={styles.emptyStartBtns}>
              <button className={styles.loadFirstBtn} onClick={handleLoadFirst} disabled={loading}>
                {loading ? <span className={styles.microSpinner} /> : null}
                {loading ? 'Cargando...' : 'Cargar primeros 20'}
              </button>
              <button className={styles.loadAllBtn} onClick={handleLoadAll} disabled={loadingAll}>
                {loadingAll ? <span className={styles.microSpinner} /> : null}
                {loadingAll ? 'Cargando...' : 'Cargar todos'}
              </button>
            </div>
          </div>
        )}

        {!displayLoading && !error && (users.length > 0 || isSearchMode) && (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {selectionMode && (
                      <th className={styles.thCheck}>
                        <input type="checkbox" className={styles.checkbox}
                          checked={displayUsers.length > 0 && displayUsers.every((u) => selectedIds.has(u.id))}
                          onChange={() => {
                            const allSelected = displayUsers.every((u) => selectedIds.has(u.id))
                            if (allSelected) {
                              setSelectedIds((prev) => { const n = new Set(prev); displayUsers.forEach((u) => n.delete(u.id)); return n })
                            } else {
                              setSelectedIds((prev) => { const n = new Set(prev); displayUsers.forEach((u) => n.add(u.id)); return n })
                              setSelectedUsers((prev) => { const m = new Map(prev); displayUsers.forEach((u) => m.set(u.id, u)); return m })
                            }
                          }}
                        />
                      </th>
                    )}
                    <th className={styles.th}>Nombre</th>
                    <th className={styles.th}>Rol</th>
                    <th className={styles.th}>UID</th>
                    <th className={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {displayUsers.length === 0 ? (
                    <tr>
                      <td colSpan={selectionMode ? 5 : 4} className={styles.empty}>
                        {isSearchMode ? 'No se encontraron usuarios con ese nombre.' : 'No hay usuarios registrados.'}
                      </td>
                    </tr>
                  ) : (
                    displayUsers.map((u) => (  
                      <UserRow
                        key={u.id}
                        user={u}
                        onUpdated={handleUpdated}
                        onDeleted={handleDeleted}
                        navigate={navigate}
                        selectionMode={selectionMode}
                        selected={selectedIds.has(u.id)}
                        onToggleSelect={handleToggleSelect}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {displayHasMore && (
              <div className={styles.loadMoreWrap}>
                <button className={styles.loadMoreBtn} onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? <span className={styles.microSpinner} /> : null}
                  {loadingMore ? 'Cargando...' : 'Cargar mas usuarios'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Barra flotante de acciones masivas */}
      {selectionMode && selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedIds.size} usuario{selectedIds.size !== 1 ? 's' : ''}</span>
          <div className={styles.bulkActions}>
            <button className={styles.bulkBtn} onClick={() => setBulkAction('addApp')}>+ App</button>
            <button className={styles.bulkBtn} onClick={() => setBulkAction('removeApp')}>- App</button>
            <button className={styles.bulkBtn} onClick={() => setBulkAction('addContact')}>+ Contacto</button>
            <button className={styles.bulkBtn} onClick={() => setBulkAction('removeContact')}>- Contacto</button>
          </div>
        </div>
      )}

      {/* Modal operacion masiva */}
      {bulkAction && (
        <BulkModal
          action={bulkAction}
          selectedCount={selectedIds.size}
          onConfirm={handleBulkConfirm}
          onClose={() => setBulkAction(null)}
        />
      )}
    </div>
  )
}