export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function fileUrl(path) {
	if (!path) return ''
	if (path.startsWith('http')) return encodeURI(path)
	return encodeURI(`${API_URL}${path}`)
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
	const headers = { 'Content-Type': 'application/json' }

	if (auth) {
		const token = localStorage.getItem('token')
		if (token) headers.Authorization = `Bearer ${token}`
	}

	const res = await fetch(`${API_URL}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	})

	const data = await res.json().catch(() => ({}))
	if (!res.ok) throw new Error(data.message || 'Request failed')
	return data
}
