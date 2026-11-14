import { useExplorerContext } from '../context/ExplorerContext.jsx'
import * as api from '../api/explorerApi.js'
import { uploadFile as sendUpload } from '../api/uploadApi.js'
import { getDescendantIds, getNodePath } from '../model/fileNode.js'
import { validateName } from '../utils/fileValidation.js'
import usePermissions from '../../auth/hooks/usePermissions.js'

export default function useFileOperations() {
  const state = useExplorerContext()
  const { hasPermissions } = usePermissions()
  const executeMutationJobs = async (jobs, message, permissions) => {
    if (!hasPermissions(...permissions)) {
      const error = 'Content management is unavailable. Refresh workspace capabilities.'
      state.setFeedback({ type: 'error', message: error })
      return { ok: false, error, completedIds: [] }
    }
    if (!state.connected || !state.beginMutation()) {
      const error = 'Connect to the backend and wait for the current operation to finish.'
      state.setFeedback({ type: 'error', message: error })
      return { ok: false, error, completedIds: [] }
    }
    const records = [], parents = [], completedIds = [], errors = []
    try {
      for (const job of jobs) {
        try {
          const record = await job.execute()
          records.push(record)
          parents.push(job.parentId, record.parentId)
          completedIds.push(job.id ?? record.id)
        } catch (error) {
          errors.push(error)
          state.connection.failConnection(error)
        }
      }
      const refreshError = records.length ? await state.synchronize(records, parents) : null
      if (records.length) state.selectMutationResults(records, state.currentFolderId)
      const error = errors.length ? (completedIds.length ? completedIds.length + ' of ' + jobs.length + ' operations completed. ' : '') + errors.map(item => item.message).join(' ') : null
      state.setFeedback({ type: error || refreshError ? 'error' : 'success', message: error || (refreshError ? message + ' The change was saved, but refreshing failed: ' + refreshError.message : message) })
      return { ok: !errors.length, records, completedIds, error }
    } finally {
      state.endMutation()
    }
  }
  const createFolder = name => {
    const error = validateName(name)
    return error ? Promise.resolve({ ok: false, error }) : executeMutationJobs([{ parentId: state.currentFolderId, execute: () => api.createFolder(state.currentFolderId, name) }], 'Folder created.', ['nodes:create'])
  }
  const uploadFile = (file, parentId = state.currentFolderId) => executeMutationJobs([{ parentId, execute: () => sendUpload(file, parentId) }], 'File uploaded.', ['nodes:create'])
  const createFile = name => {
    const error = validateName(name)
    return error ? Promise.resolve({ ok: false, error }) : uploadFile(new File([], name, { type: /\.txt$/i.test(name) ? 'text/plain' : '' }))
  }
  const renameNode = (id, name) => {
    const error = validateName(name)
    return error ? Promise.resolve({ ok: false, error }) : executeMutationJobs([{ id, parentId: state.nodes.find(node => node.id === id)?.parentId, execute: () => api.renameNode(id, name) }], 'Item renamed.', ['nodes:update'])
  }
  const batch = (nodeIds, operation, parentId) => {
    const unique = [...new Set(Array.isArray(nodeIds) ? nodeIds : [nodeIds])]
    const ids = unique.filter(id => !unique.some(other => other !== id && getDescendantIds(state.nodes, other).includes(id)))
    if (!ids.length) return Promise.resolve({ ok: false, error: 'Select an item first.', completedIds: [] })
    return executeMutationJobs(ids.map(id => ({ id, parentId: operation === 'copy' ? null : state.nodes.find(node => node.id === id)?.parentId,
      execute: async () => {
        if (operation === 'delete') return api.deleteNode(id)
        if (operation === 'move') return api.moveNode(id, parentId)
        const source = await api.getNode(id)
        const destination = await api.getChildren(parentId)
        let name = source.name, count = 1
        const dot = source.type === 'file' ? source.name.lastIndexOf('.') : -1
        const stem = dot > 0 ? source.name.slice(0, dot) : source.name
        const extension = dot > 0 ? source.name.slice(dot) : ''
        while (destination.children.some(node => node.name.toLowerCase() === name.toLowerCase())) {
          name = stem + ' - Copy' + (count === 1 ? '' : ' (' + count + ')') + extension
          count++
        }
        return api.copyNode(id, parentId, name)
      },
    })), { delete: 'Items deleted.', move: 'Items moved.', copy: 'Items copied.' }[operation], { delete: ['nodes:delete'], move: ['nodes:update', 'nodes:create'], copy: ['nodes:read', 'nodes:create'] }[operation])
  }
  const downloadFile = async id => {
    try {
      const node = await api.getNode(id)
      const content = await api.downloadFile(id)
      const url = URL.createObjectURL(content)
      const link = document.createElement('a')
      link.href = url
      link.download = node.name
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      state.setFeedback(null)
      return true
    } catch (error) { state.connection.failConnection(error); state.setFeedback({ type: 'error', message: error.message }); return false }
  }
  const getNode = id => {
    const node = state.nodes.find(item => item.id === id)
    return node ? { ...node, path: getNodePath(state.nodes, id), aggregateSize: node.type === 'file' ? node.size : null, childCount: null } : null
  }
  return { createFolder, createFile, renameNode, deleteNode: ids => batch(ids, 'delete'),
    moveNode: (ids, parentId) => batch(ids, 'move', parentId), copyNode: (ids, parentId) => batch(ids, 'copy', parentId), uploadFile, downloadFile, getNode }
}
