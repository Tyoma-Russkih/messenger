<template>
	<div class="h-screen overflow-hidden bg-gray-50">
		<div class="h-full max-w-6xl mx-auto border-x bg-white flex flex-col">
			<header
				class="h-14 shrink-0 border-b px-4 flex items-center justify-between bg-white"
			>
				<button
					type="button"
					class="font-semibold hover:opacity-80"
					@click="isProfileOpen = true"
				>
					{{
						auth.user?.name ||
						(auth.user?.username
							? '@' + auth.user.username
							: auth.user?.phone || 'Messenger')
					}}
				</button>

				<button
					type="button"
					class="rounded-xl border px-3 py-1.5 hover:bg-gray-50"
					@click="logout"
				>
					Выйти
				</button>
			</header>

			<div class="flex-1 min-h-0 flex">
				<div class="w-80 shrink-0 border-r min-h-0">
					<ChatSidebar />
				</div>

				<div class="flex-1 min-h-0">
					<ChatMain />
				</div>
			</div>
		</div>
	</div>
	<ProfileModal :open="isProfileOpen" @close="isProfileOpen = false" />
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, nextTick, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import ChatSidebar from '../components/chat/ChatSidebar.vue'
import ChatMain from '../components/chat/ChatMain.vue'
import ProfileModal from '../components/profile/ProfileModal.vue'

import { useChatStore } from '../stores/chat'
import { useAuthStore } from '../stores/auth'

import { connectSocket, disconnectSocket, getSocket } from '../realtime/socket'

const chatStore = useChatStore()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const isProfileOpen = ref(false)

function joinActive() {
	const s = getSocket()
	if (!s) return
	const id = chatStore.activeChatId
	if (id) s.emit('chat:join', { chatId: id })
}

function leaveChat(id) {
	const s = getSocket()
	if (!s) return
	if (id) s.emit('chat:leave', { chatId: id })
}

onMounted(async () => {
	const s = connectSocket()
	if (s) {
		s.off('chat:updated')

		s.on('chat:updated', async payload => {
			if (!payload?.chatId) return

			const exists = chatStore.chats.some(c => c.id === payload.chatId)

			if (!exists) {
				await chatStore.loadChats()
				return
			}

			chatStore.applyChatUpdated(payload)
		})
	}

	if (s) {
		s.off('presence:sync')
		s.on('presence:sync', ({ onlineUserIds }) => {
			if (!Array.isArray(onlineUserIds)) return
			for (const id of onlineUserIds) {
				chatStore.setUserOnline({ userId: id })
			}
		})
	}

	if (s) {
		s.off('user:online')
		s.off('user:offline')

		s.on('user:online', ({ userId }) => {
			chatStore.setUserOnline({ userId })
		})

		s.on('user:offline', ({ userId, lastSeenAt }) => {
			chatStore.setUserOffline({ userId, lastSeenAt })
		})
	}

	if (s) {
		s.off('typing')
		s.on('typing', payload => {
			chatStore.setTyping(payload)
		})
	}

	// ✅ важное: при каждом connect (в т.ч. после реконнекта) снова join активного чата
	if (s) {
		s.off('connect', joinActive)
		s.on('connect', async () => {
			await nextTick()
			joinActive()
		})
	}

	await chatStore.loadChats()
	await nextTick()
	joinActive()

	const routeChatId = route.params.chatId
	if (routeChatId) {
		const exists = chatStore.chats.some(c => c.id === routeChatId)
		chatStore.setActiveChat(exists ? routeChatId : null)
	} else {
		chatStore.setActiveChat(null)
	}
})

onBeforeUnmount(() => {
	disconnectSocket()
})

watch(
  () => route.params.chatId,
  (chatId) => {
    if (!chatId) {
      chatStore.setActiveChat(null)
      return
    }

    const exists = chatStore.chats.some(c => c.id === chatId)
    chatStore.setActiveChat(exists ? chatId : null)
  }
)

watch(
	() => chatStore.activeChatId,
	(newId, oldId) => {
		leaveChat(oldId)
		// join чуть позже, чтобы store/DOM успели обновиться
		nextTick(() => joinActive())
	},
)

function logout() {
	disconnectSocket()
	auth.logout()
	router.replace('/login')
}
</script>
