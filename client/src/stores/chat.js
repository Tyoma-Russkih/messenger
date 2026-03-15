import { defineStore } from 'pinia'
import { api } from '../api/http'

export const useChatStore = defineStore('chat', {
	state: () => ({
		chats: [], // [{ id, title, lastMessageText, lastMessageAt }]
		activeChatId: null,
		isLoading: false,
		typingByChat: {}, // { [chatId]: { userId, until } }
		onlineUsers: {}, // { userId: { online: bool, lastSeenAt } }
	}),

	getters: {
		activeChat(state) {
			return state.chats.find(c => c.id === state.activeChatId) || null
		},
		isTyping(state) {
			const t = state.typingByChat[state.activeChatId]
			if (!t) return false
			return Date.now() < t.until
		},
	},

	actions: {
		async loadChats() {
			this.isLoading = true
			try {
				const data = await api('/chats')
				this.chats = data.chats || []
			} finally {
				this.isLoading = false
			}
		},

		setActiveChat(id) {
			this.activeChatId = id
		},

		// ✅ нужно для Socket.IO, чтобы поднять чат вверх и обновить last message
		applyChatUpdated({ chatId, lastMessageText, lastMessageAt, unreadCount }) {
			const i = this.chats.findIndex(c => c.id === chatId)
			if (i === -1) return

			const old = this.chats[i]

			const updated = {
				...old,
				...(lastMessageText !== undefined ? { lastMessageText } : {}),
				...(lastMessageAt !== undefined ? { lastMessageAt } : {}),
				...(unreadCount !== undefined ? { unreadCount } : {}),
			}

			// ✅ поднимаем наверх ТОЛЬКО если реально обновилось "последнее сообщение"
			const hasLastUpdate =
				lastMessageText !== undefined || lastMessageAt !== undefined

			if (hasLastUpdate) {
				this.chats.splice(i, 1)
				this.chats.unshift(updated)
			} else {
				// ✅ иначе просто обновляем на месте (например, только unreadCount)
				this.chats[i] = updated
			}
		},

		setTyping({ chatId, userId, isTyping }) {
			if (!chatId) return
			if (!isTyping) {
				delete this.typingByChat[chatId]
				return
			}
			// держим typing 3 секунды после последнего события
			this.typingByChat[chatId] = { userId, until: Date.now() + 3000 }
		},
		cleanupTyping() {
			const now = Date.now()
			for (const [chatId, t] of Object.entries(this.typingByChat)) {
				if (!t || now >= t.until) delete this.typingByChat[chatId]
			}
		},
		setUserOnline({ userId }) {
			this.onlineUsers[userId] = { online: true, lastSeenAt: null }
		},
		setUserOffline({ userId, lastSeenAt }) {
			this.onlineUsers[userId] = { online: false, lastSeenAt }
		},
	},

	reset() {
		this.chats = []
		this.activeChatId = null
		this.isLoading = false
	},
})
