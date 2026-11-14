import { useState } from 'react'
import { createDocument, saveDocument } from '../api/documentApi.js'
/**
 * save resolves to the saved record, or null when this render observes pending
 * work or a save failure is caught. pending/error/conflict distinguish those cases;
 * callers must keep their truthy-record check. No cancellation or write replay is
 * added here. reset clears feedback only, without cancelling a save or clearing pending.
 */
export default function useSaveDocument() {
  const [pending, setPending] = useState(false), [error, setError] = useState(null), [conflict, setConflict] = useState(false)
  const save = async (id, body) => {
    if (pending) return null
    setPending(true); setError(null); setConflict(false)
    try { return await (id ? saveDocument(id, body) : createDocument(body)) }
    catch (failure) { setError(failure.message); if (failure.code === 'revision_conflict') setConflict(true); return null }
    finally { setPending(false) }
  }
  const reset = () => { setError(null); setConflict(false) }
  return { save, pending, error, conflict, setConflict, reset }
}
