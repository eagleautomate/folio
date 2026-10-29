// Upload a file to Frappe and attach it to a document. Files are private:
// only logged-in users can open them.
export async function uploadFile(file, { doctype, docname, isPrivate = true } = {}) {
  const form = new FormData()
  form.append('file', file, file.name)
  form.append('is_private', isPrivate ? '1' : '0')
  if (doctype) form.append('doctype', doctype)
  if (docname) form.append('docname', docname)

  const response = await fetch('/api/method/upload_file', {
    method: 'POST',
    headers: { 'X-Frappe-CSRF-Token': window.csrf_token, Accept: 'application/json' },
    body: form,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    let message = 'Upload failed'
    try {
      message = JSON.parse(JSON.parse(data._server_messages)[0]).message || message
    } catch {
      // keep generic message
    }
    throw new Error(message)
  }
  return data.message.file_url
}
