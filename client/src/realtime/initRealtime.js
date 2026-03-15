import { connectSocket } from './socket'
import { useChatStore } from '../stores/chat'
import {
	buildMessageNotificationBody,
	showSystemNotification,
} from '../utils/notifications'

let isRealtimeInitialized = false

export function initRealtime() {
	if (isRealtimeInitialized) return

	const socket = connectSocket()
	if (!socket) return

	const chatStore = useChatStore()

	socket.on('chat:updated', payload => {
		chatStore.applyChatUpdated(payload)
	})

	socket.on('typing', payload => {
		chatStore.setTyping(payload)
	})

	socket.on('user:online', ({ userId }) => {
		chatStore.setUserOnline({ userId })
	})

	socket.on('user:offline', ({ userId, lastSeenAt }) => {
		chatStore.setUserOffline({ userId, lastSeenAt })
	})

	socket.on('presence:sync', ({ onlineUserIds = [] }) => {
		for (const userId of onlineUserIds) {
			chatStore.setUserOnline({ userId })
		}
	})

	socket.on('message:new', ({ chatId, message }) => {
		const isActiveChat = chatStore.activeChatId === chatId
		const isWindowVisible = document.visibilityState === 'visible'
		const shouldNotify = !isActiveChat || !isWindowVisible

		if (!shouldNotify) return

		const chat = chatStore.chats.find(c => c.id === chatId)

		showSystemNotification({
			title: chat?.title || 'Новое сообщение',
			body: buildMessageNotificationBody(message),
			tag: `chat-${chatId}`,
			data: { chatId, messageId: message?.id || null },
		})
	})

	isRealtimeInitialized = true
}
