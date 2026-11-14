export const documentDate = value => value ? new Date(value).toLocaleString() : 'Unknown'
export const documentSize = value => value < 1024 ? value + ' B' : value < 1024 * 1024 ? (value / 1024).toFixed(1) + ' KB' : (value / 1024 / 1024).toFixed(1) + ' MB'
