import { useState, useEffect } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useNavigate, useParams } from 'react-router-dom'
import { db, auth } from '../firebase'
import styles from './UserDetail.module.css'

function Avatar({ name }) {
  const letter = (name || '?')[0].toUpperCase()
  return <div className={styles.avatar}>{letter}</div>
}

// ── Apps Section ───────────────────────────────────────────────────────────────
function AppsSection({ userId, initialApps }) {
  const [apps, setApps] = useState(initialApps || [])
  const [open, setOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPkg, setNewPkg] = useState('')
  const [addError, setAddError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [bulkJson, setBulkJson] = useState('')
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkResult, setBulkResult] = useState('')
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null)
  const [deletingIndex, setDeletingIndex] = useState(null)

  const persist = async (newApps) => {
    await updateDoc(doc(db, 'users', userId), { apps: newApps })
    setApps(newApps)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const pkg = newPkg.trim()
    if (!pkg) { setAddError('Ingresa el nombre del paquete.'); return }
    if (apps.includes(pkg)) { setAddError('Ese paquete ya existe.'); return }
    setSaving(true); setAddError('')
    try { await persist([...apps, pkg]); setNewPkg(''); setShowAddForm(false) }
    catch { setAddError('Error al anadir.') }
    finally { setSaving(false) }
  }

  const handleBulkImport = async (e) => {
    e.preventDefault()
    setBulkError(''); setBulkResult('')
    let parsed
    try { parsed = JSON.parse(bulkJson) }
    catch { setBulkError('JSON invalido. Verifica el formato.'); return }
    if (!Array.isArray(parsed)) { setBulkError('Debe ser un array [ ... ].'); return }
    setBulkImporting(true)
    let added = 0, skipped = 0
    const toAdd = []
    for (const item of parsed) {
      const pkg = String(typeof item === 'string' ? item : (item.package || item.id || '')).trim()
      if (!pkg) { skipped++; continue }
      if (apps.includes(pkg) || toAdd.includes(pkg)) { skipped++; continue }
      toAdd.push(pkg); added++
    }
    if (added > 0) {
      try { await persist([...apps, ...toAdd]) }
      catch { setBulkError('Error al importar.'); setBulkImporting(false); return }
    }
    setBulkImporting(false)
    const parts = []
    if (added > 0) parts.push(`${added} importado${added !== 1 ? 's' : ''}`)
    if (skipped > 0) parts.push(`${skipped} omitido${skipped !== 1 ? 's' : ''}`)
    setBulkResult(parts.join(', '))
    if (added > 0) { setBulkJson(''); setShowBulkForm(false) }
  }

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try { await persist([]); setConfirmDeleteAll(false) }
    catch { console.error('Error al eliminar todo') }
    finally { setDeletingAll(false) }
  }

  const handleEdit = async (index) => {
    const pkg = editDraft.trim()
    if (!pkg) { setEditError('El paquete no puede estar vacio.'); return }
    if (pkg !== apps[index] && apps.includes(pkg)) { setEditError('Ese paquete ya existe.'); return }
    setEditSaving(true); setEditError('')
    try {
      const newApps = [...apps]; newApps[index] = pkg
      await persist(newApps); setEditingIndex(null)
    } catch { setEditError('Error al guardar.') }
    finally { setEditSaving(false) }
  }

  const handleDelete = async (index) => {
    setDeletingIndex(index)
    try { await persist(apps.filter((_, i) => i !== index)); setConfirmDeleteIndex(null) }
    catch { console.error('Error al eliminar') }
    finally { setDeletingIndex(null) }
  }

  return (
    <div className={`${styles.section} ${open ? styles.sectionOpen : ''}`}>
      <button className={styles.sectionHeader} onClick={() => setOpen(v => !v)}>
        <span className={styles.sectionLeft}>
          <span className={styles.sectionIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <span className={styles.sectionLabel}>Aplicaciones Permitidas</span>
          <span className={styles.sectionCount}>{apps.length}</span>
        </span>
        <div className={styles.sectionRight}>
          {open && (
            <>
              <button className={styles.addBtn} onClick={(e) => { e.stopPropagation(); setShowAddForm(v => !v); setShowBulkForm(false); setAddError('') }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                Anadir
              </button>
              <button className={styles.bulkBtn} onClick={(e) => { e.stopPropagation(); setShowBulkForm(v => !v); setShowAddForm(false); setBulkError(''); setBulkResult('') }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><line x1="8" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                JSON
              </button>
              {apps.length > 0 && !confirmDeleteAll && (
                <button className={styles.deleteAllBtn} onClick={(e) => { e.stopPropagation(); setConfirmDeleteAll(true); setShowAddForm(false); setShowBulkForm(false) }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Eliminar todo
                </button>
              )}
              {confirmDeleteAll && (
                <span className={styles.deleteAllConfirm}>
                  <span className={styles.deleteAllConfirmText}>Eliminar los {apps.length}?</span>
                  <button className={styles.deleteConfirmBtn} onClick={(e) => { e.stopPropagation(); handleDeleteAll() }} disabled={deletingAll}>{deletingAll ? <span className={styles.microSpinner} /> : null}Si</button>
                  <button className={styles.cancelBtn} onClick={(e) => { e.stopPropagation(); setConfirmDeleteAll(false) }} disabled={deletingAll}>No</button>
                </span>
              )}
            </>
          )}
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </button>

      {open && (
        <div className={styles.sectionBody}>
          {showAddForm && (
            <form className={styles.addForm} onSubmit={handleAdd}>
              <div className={styles.addFormFields}>
                <div className={styles.addField}>
                  <label className={styles.addLabel}>Nombre de paquete</label>
                  <input className={styles.addInput} placeholder="com.ejemplo.app" value={newPkg} onChange={e => setNewPkg(e.target.value)} disabled={saving} />
                </div>
              </div>
              {addError && <p className={styles.addError}>{addError}</p>}
              <div className={styles.addFormActions}>
                <button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? <span className={styles.microSpinner} /> : null}Anadir app</button>
                <button type="button" className={styles.cancelBtn} onClick={() => { setShowAddForm(false); setAddError('') }} disabled={saving}>Cancelar</button>
              </div>
            </form>
          )}

          {showBulkForm && (
            <form className={styles.bulkForm} onSubmit={handleBulkImport}>
              <div className={styles.bulkHeader}>
                <span className={styles.bulkTitle}>Importar desde JSON</span>
                <span className={styles.bulkHint}>{`["com.whatsapp", "com.example"]  o  [{"package": "com.app"}, ...]`}</span>
              </div>
              <textarea className={styles.bulkTextarea} placeholder="Pega el JSON aqui..." value={bulkJson} onChange={e => setBulkJson(e.target.value)} disabled={bulkImporting} rows={6} />
              {bulkError && <p className={styles.addError}>{bulkError}</p>}
              {bulkResult && <p className={styles.bulkResult}>{bulkResult}</p>}
              <div className={styles.addFormActions}>
                <button type="submit" className={styles.saveBtn} disabled={bulkImporting}>{bulkImporting ? <span className={styles.microSpinner} /> : null}Importar</button>
                <button type="button" className={styles.cancelBtn} onClick={() => { setShowBulkForm(false); setBulkError(''); setBulkResult(''); setBulkJson('') }} disabled={bulkImporting}>Cancelar</button>
              </div>
            </form>
          )}

          {apps.length === 0 && <div className={styles.emptyRow}>Sin aplicaciones permitidas.</div>}
          {apps.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Paquete</th>
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((pkg, i) => {
                    if (confirmDeleteIndex === i) {
                      return (
                        <tr key={i} className={`${styles.tr} ${styles.trDeleting}`}>
                          <td className={styles.td}><span className={styles.deleteConfirmText}>Eliminar <strong>{pkg}</strong>?</span></td>
                          <td className={styles.td}>
                            <div className={styles.actionBtns}>
                              <button className={styles.deleteConfirmBtn} onClick={() => handleDelete(i)} disabled={deletingIndex === i}>{deletingIndex === i ? <span className={styles.microSpinner} /> : null}Eliminar</button>
                              <button className={styles.cancelBtn} onClick={() => setConfirmDeleteIndex(null)} disabled={deletingIndex === i}>Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    if (editingIndex === i) {
                      return (
                        <tr key={i} className={`${styles.tr} ${styles.trEditing}`}>
                          <td className={styles.td}><input className={styles.editInput} value={editDraft} onChange={e => setEditDraft(e.target.value)} autoFocus /></td>
                          <td className={styles.td}>
                            <div className={styles.actionBtns}>
                              <button className={styles.saveBtn} onClick={() => handleEdit(i)} disabled={editSaving}>{editSaving ? <span className={styles.microSpinner} /> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}Guardar</button>
                              <button className={styles.cancelBtn} onClick={() => { setEditingIndex(null); setEditError('') }} disabled={editSaving}>Cancelar</button>
                            </div>
                            {editError && <p className={styles.saveErrorRow}>{editError}</p>}
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={i} className={styles.tr}>
                        <td className={styles.td}>{pkg}</td>
                        <td className={styles.td}>
                          <div className={styles.actionBtns}>
                            <button className={styles.editBtn} onClick={() => { setEditingIndex(i); setEditDraft(pkg); setEditError('') }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              Editar
                            </button>
                            <button className={styles.deleteBtn} onClick={() => { setConfirmDeleteIndex(i); setEditingIndex(null) }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Contacts Section ───────────────────────────────────────────────────────────
function ContactsSection({ userId, initialContacts }) {
  const [contacts, setContacts] = useState(initialContacts || [])
  const [open, setOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNumber, setNewNumber] = useState('')
  const [addError, setAddError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [bulkJson, setBulkJson] = useState('')
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkResult, setBulkResult] = useState('')
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editDraft, setEditDraft] = useState({ name: '', number: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null)
  const [deletingIndex, setDeletingIndex] = useState(null)

  const persist = async (newContacts) => {
    await updateDoc(doc(db, 'users', userId), { contacts: newContacts })
    setContacts(newContacts)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const name = newName.trim(); const number = newNumber.trim()
    if (!name || !number) { setAddError('Completa ambos campos.'); return }
    setSaving(true); setAddError('')
    try { await persist([...contacts, { name, number }]); setNewName(''); setNewNumber(''); setShowAddForm(false) }
    catch { setAddError('Error al anadir.') }
    finally { setSaving(false) }
  }

  const handleBulkImport = async (e) => {
    e.preventDefault()
    setBulkError(''); setBulkResult('')
    let parsed
    try { parsed = JSON.parse(bulkJson) }
    catch { setBulkError('JSON invalido. Verifica el formato.'); return }
    if (!Array.isArray(parsed)) { setBulkError('Debe ser un array [ ... ].'); return }
    setBulkImporting(true)
    let added = 0, skipped = 0
    const toAdd = []
    for (const item of parsed) {
      const name = String(item.name || '').trim()
      const number = String(item.number || '').trim()
      if (!name || !number) { skipped++; continue }
      toAdd.push({ name, number }); added++
    }
    if (added > 0) {
      try { await persist([...contacts, ...toAdd]) }
      catch { setBulkError('Error al importar.'); setBulkImporting(false); return }
    }
    setBulkImporting(false)
    const parts = []
    if (added > 0) parts.push(`${added} importado${added !== 1 ? 's' : ''}`)
    if (skipped > 0) parts.push(`${skipped} omitido${skipped !== 1 ? 's' : ''}`)
    setBulkResult(parts.join(', '))
    if (added > 0) { setBulkJson(''); setShowBulkForm(false) }
  }

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try { await persist([]); setConfirmDeleteAll(false) }
    catch { console.error('Error al eliminar todo') }
    finally { setDeletingAll(false) }
  }

  const handleEdit = async (index) => {
    const name = editDraft.name.trim(); const number = editDraft.number.trim()
    if (!name || !number) { setEditError('Completa ambos campos.'); return }
    setEditSaving(true); setEditError('')
    try {
      const newContacts = [...contacts]; newContacts[index] = { name, number }
      await persist(newContacts); setEditingIndex(null)
    } catch { setEditError('Error al guardar.') }
    finally { setEditSaving(false) }
  }

  const handleDelete = async (index) => {
    setDeletingIndex(index)
    try { await persist(contacts.filter((_, i) => i !== index)); setConfirmDeleteIndex(null) }
    catch { console.error('Error al eliminar') }
    finally { setDeletingIndex(null) }
  }

  return (
    <div className={`${styles.section} ${open ? styles.sectionOpen : ''}`}>
      <button className={styles.sectionHeader} onClick={() => setOpen(v => !v)}>
        <span className={styles.sectionLeft}>
          <span className={styles.sectionIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <span className={styles.sectionLabel}>Contactos</span>
          <span className={styles.sectionCount}>{contacts.length}</span>
        </span>
        <div className={styles.sectionRight}>
          {open && (
            <>
              <button className={styles.addBtn} onClick={(e) => { e.stopPropagation(); setShowAddForm(v => !v); setShowBulkForm(false); setAddError('') }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                Anadir
              </button>
              <button className={styles.bulkBtn} onClick={(e) => { e.stopPropagation(); setShowBulkForm(v => !v); setShowAddForm(false); setBulkError(''); setBulkResult('') }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><line x1="8" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                JSON
              </button>
              {contacts.length > 0 && !confirmDeleteAll && (
                <button className={styles.deleteAllBtn} onClick={(e) => { e.stopPropagation(); setConfirmDeleteAll(true); setShowAddForm(false); setShowBulkForm(false) }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Eliminar todo
                </button>
              )}
              {confirmDeleteAll && (
                <span className={styles.deleteAllConfirm}>
                  <span className={styles.deleteAllConfirmText}>Eliminar los {contacts.length}?</span>
                  <button className={styles.deleteConfirmBtn} onClick={(e) => { e.stopPropagation(); handleDeleteAll() }} disabled={deletingAll}>{deletingAll ? <span className={styles.microSpinner} /> : null}Si</button>
                  <button className={styles.cancelBtn} onClick={(e) => { e.stopPropagation(); setConfirmDeleteAll(false) }} disabled={deletingAll}>No</button>
                </span>
              )}
            </>
          )}
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </button>

      {open && (
        <div className={styles.sectionBody}>
          {showAddForm && (
            <form className={styles.addForm} onSubmit={handleAdd}>
              <div className={styles.addFormFields}>
                <div className={styles.addField}>
                  <label className={styles.addLabel}>Nombre</label>
                  <input className={styles.addInput} placeholder="Nombre del contacto" value={newName} onChange={e => setNewName(e.target.value)} disabled={saving} />
                </div>
                <div className={styles.addField}>
                  <label className={styles.addLabel}>Numero</label>
                  <input className={styles.addInput} placeholder="+1234567890" value={newNumber} onChange={e => setNewNumber(e.target.value)} disabled={saving} />
                </div>
              </div>
              {addError && <p className={styles.addError}>{addError}</p>}
              <div className={styles.addFormActions}>
                <button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? <span className={styles.microSpinner} /> : null}Anadir contacto</button>
                <button type="button" className={styles.cancelBtn} onClick={() => { setShowAddForm(false); setAddError('') }} disabled={saving}>Cancelar</button>
              </div>
            </form>
          )}

          {showBulkForm && (
            <form className={styles.bulkForm} onSubmit={handleBulkImport}>
              <div className={styles.bulkHeader}>
                <span className={styles.bulkTitle}>Importar desde JSON</span>
                <span className={styles.bulkHint}>{`[{"name": "Juan", "number": "+52..."}, ...]`}</span>
              </div>
              <textarea className={styles.bulkTextarea} placeholder="Pega el JSON aqui..." value={bulkJson} onChange={e => setBulkJson(e.target.value)} disabled={bulkImporting} rows={6} />
              {bulkError && <p className={styles.addError}>{bulkError}</p>}
              {bulkResult && <p className={styles.bulkResult}>{bulkResult}</p>}
              <div className={styles.addFormActions}>
                <button type="submit" className={styles.saveBtn} disabled={bulkImporting}>{bulkImporting ? <span className={styles.microSpinner} /> : null}Importar</button>
                <button type="button" className={styles.cancelBtn} onClick={() => { setShowBulkForm(false); setBulkError(''); setBulkResult(''); setBulkJson('') }} disabled={bulkImporting}>Cancelar</button>
              </div>
            </form>
          )}

          {contacts.length === 0 && <div className={styles.emptyRow}>Sin contactos registrados.</div>}
          {contacts.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Nombre</th>
                    <th className={styles.th}>Numero</th>
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact, i) => {
                    if (confirmDeleteIndex === i) {
                      return (
                        <tr key={i} className={`${styles.tr} ${styles.trDeleting}`}>
                          <td colSpan={2} className={styles.td}><span className={styles.deleteConfirmText}>Eliminar a <strong>{contact.name}</strong>?</span></td>
                          <td className={styles.td}>
                            <div className={styles.actionBtns}>
                              <button className={styles.deleteConfirmBtn} onClick={() => handleDelete(i)} disabled={deletingIndex === i}>{deletingIndex === i ? <span className={styles.microSpinner} /> : null}Eliminar</button>
                              <button className={styles.cancelBtn} onClick={() => setConfirmDeleteIndex(null)} disabled={deletingIndex === i}>Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    if (editingIndex === i) {
                      return (
                        <tr key={i} className={`${styles.tr} ${styles.trEditing}`}>
                          <td className={styles.td}><input className={styles.editInput} value={editDraft.name} onChange={e => setEditDraft(prev => ({ ...prev, name: e.target.value }))} autoFocus /></td>
                          <td className={styles.td}><input className={styles.editInput} value={editDraft.number} onChange={e => setEditDraft(prev => ({ ...prev, number: e.target.value }))} /></td>
                          <td className={styles.td}>
                            <div className={styles.actionBtns}>
                              <button className={styles.saveBtn} onClick={() => handleEdit(i)} disabled={editSaving}>{editSaving ? <span className={styles.microSpinner} /> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}Guardar</button>
                              <button className={styles.cancelBtn} onClick={() => { setEditingIndex(null); setEditError('') }} disabled={editSaving}>Cancelar</button>
                            </div>
                            {editError && <p className={styles.saveErrorRow}>{editError}</p>}
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={i} className={styles.tr}>
                        <td className={styles.td}>{contact.name}</td>
                        <td className={styles.td}>{contact.number}</td>
                        <td className={styles.td}>
                          <div className={styles.actionBtns}>
                            <button className={styles.editBtn} onClick={() => { setEditingIndex(i); setEditDraft({ name: contact.name, number: contact.number }); setEditError('') }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              Editar
                            </button>
                            <button className={styles.deleteBtn} onClick={() => { setConfirmDeleteIndex(i); setEditingIndex(null) }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function UserDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDoc(doc(db, 'users', userId))
      .then((snap) => { if (snap.exists()) setUser({ id: snap.id, ...snap.data() }) })
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
          <div className={styles.stateBox}><span className={styles.bigSpinner} /></div>
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
              <AppsSection userId={userId} initialApps={user.apps || []} />
              <ContactsSection userId={userId} initialContacts={user.contacts || []} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
