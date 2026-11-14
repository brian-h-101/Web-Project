export function validateDocument(draft, format) {
  const name = draft.name
  if (!name?.trim() || name !== name.trim() || name.length > 255 || /[\\/:*?"<>|]/.test(name) || [...name].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || name.endsWith('.') || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i.test(name)) return 'Enter a valid filename of at most 255 characters.'
  if (format === 'markdown' && !/\.md$/i.test(name)) return 'Markdown filenames must end with .md.'
  if (format === 'text' && !/\.txt$/i.test(name)) return 'Text filenames must end with .txt.'
  return null
}
