import { io } from 'socket.io-client'
import { API_URL } from '../api/http'

let socket = null

export function getSocket() {
	return socket
}

export function connectSocket() {
	const token = localStorage.getItem('token')
	if (!token) return null

	// ✅ важно: возвращаем существующий сокет, даже если он ещё подключается
	if (socket) return socket

	socket = io(API_URL, {
		transports: ['websocket'],
		auth: { token },
	})

	socket.on('connect', () => {
		console.log('[socket] connected', socket.id)
	})

	socket.on('connect_error', err => {
		console.log('[socket] connect_error', err.message)
	})

	socket.on('disconnect', reason => {
		console.log('[socket] disconnected', reason)
	})

	return socket
}

export function disconnectSocket() {
	if (socket) {
		socket.disconnect()
		socket = null
	}
}
