export function createFileNode(fields) {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), parentId: null, name: '', type: 'file', size: 0,
    mimeType: '', createdAt: now, updatedAt: now, deletedAt: null, content: null, ...fields }
}

export function createInitialNodes() {
  const date = '2026-10-14T12:00:00.000Z'
  const folder = (id, parentId, name) => createFileNode({ id, parentId, name, type: 'folder', createdAt: date, updatedAt: date })
  const file = (id, parentId, name, mimeType, text, size) => {
    const content = text == null ? null : new Blob([text], { type: mimeType })
    return createFileNode({ id, parentId, name, mimeType, content, size: content?.size ?? size, createdAt: date, updatedAt: date })
  }
  return [
    folder('root', null, 'Root'),
    folder('documents', 'root', 'Documents'),
    folder('projects', 'documents', 'Projects'),
    folder('src', 'projects', 'src'),
    file('app-jsx', 'src', 'App.jsx', 'text/javascript', "export default function App() {\n  return <h1>Hello from the simulated project!</h1>\n}\n"),
    file('package-json', 'projects', 'package.json', 'application/json', '{\n  "name": "simulated-project",\n  "version": "1.0.0"\n}\n'),
    folder('notes', 'documents', 'Notes'),
    file('readme', 'notes', 'readme.txt', 'text/plain', 'Welcome to the File-System Simulator.\n\nAll folders, files, and changes stay in browser memory.\nUpload a text file or image to preview its actual contents.\nReloading resets this temporary hierarchy.\n'),
    folder('images', 'root', 'Images'),
    file('photo-1', 'images', 'photo1.png', 'image/png', null, 245760),
    file('photo-2', 'images', 'photo2.png', 'image/png', null, 389120),
  ]
}

export function isNodeDeleted(nodes, node) {
  let current = node
  const visited = new Set()
  while (current && !visited.has(current.id)) {
    if (current.deletedAt) return true
    visited.add(current.id)
    current = nodes.find(item => item.id === current.parentId)
  }
  return false
}

export function getNodePath(nodes, id) {
  const parts = []
  let node = nodes.find(item => item.id === id)
  const visited = new Set()
  while (node && !visited.has(node.id)) {
    parts.unshift(node.name)
    visited.add(node.id)
    node = nodes.find(item => item.id === node.parentId)
  }
  return '/' + parts.join('/')
}

export function getDescendantIds(nodes, id) {
  const ids = new Set([id])
  let changed = true
  while (changed) {
    changed = false
    for (const node of nodes) {
      if (ids.has(node.parentId) && !ids.has(node.id)) { ids.add(node.id); changed = true }
    }
  }
  return [...ids]
}
