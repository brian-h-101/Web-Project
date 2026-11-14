export function documentModel(value) {
  if (!value || typeof value.id !== 'string' || !Array.isArray(value.tags) || !Number.isSafeInteger(Number(value.revision))) throw new Error('The backend returned invalid document metadata.')
  return { ...value, revision: String(value.revision), id: String(value.id), parentId: value.parentId == null ? null : String(value.parentId),
    tags: value.tags.map(tag => ({ ...tag, id: String(tag.id) })),
    author: value.author ? { ...value.author, id: String(value.author.id) } : null }
}
export const isDocumentFile = node => node?.type === 'file' && /\.(md|txt|pdf)$/i.test(node.name)
export const isEditableFormat = format => ['markdown', 'text'].includes(format)
