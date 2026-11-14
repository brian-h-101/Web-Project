export const sortTags = tags => [...tags].sort((a, b) => a.normalizedName.localeCompare(b.normalizedName) || a.id.localeCompare(b.id))
export function groupDocuments(documents) {
  const groups = new Map()
  for (const document of documents) for (const tag of document.tags.length ? document.tags : [{ id: null, name: 'Untagged', normalizedName: '' }]) {
    if (!groups.has(tag.id)) groups.set(tag.id, { tag, documents: [] })
    groups.get(tag.id).documents.push(document)
  }
  return [...groups.values()].sort((a, b) => (a.tag.id === null) - (b.tag.id === null) || a.tag.normalizedName.localeCompare(b.tag.normalizedName))
}
