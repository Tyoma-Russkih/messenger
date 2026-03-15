<template>
	<aside class="h-full bg-white flex flex-col min-h-0">
		<div class="p-3 border-b shrink-0">
			<div class="text-sm font-semibold">Чаты</div>

			<input
				class="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
				placeholder="Поиск по чатам"
				v-model="query"
			/>

			<div class="mt-3">
				<div class="text-xs text-gray-500 mb-1">
					Найти пользователя по username
				</div>

				<div class="flex gap-2">
					<input
						class="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
						placeholder="@username"
						v-model="userSearch"
						@input="onSearchUsers"
					/>

					<button
						class="rounded-xl bg-black text-white px-3 py-2 text-sm hover:opacity-90 disabled:opacity-50"
						:disabled="isSearchingUsers || !normalizedSearch"
						@click="onSearchUsers"
					>
						Найти
					</button>
				</div>

				<div v-if="userSearchError" class="mt-2 text-xs text-red-600">
					{{ userSearchError }}
				</div>

				<div
					v-if="userSearchResults.length > 0"
					class="mt-2 rounded-xl border overflow-hidden"
				>
					<button
						v-for="user in userSearchResults"
						:key="user.id"
						type="button"
						class="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
						@click="openDirectByUsername(user.username)"
					>
						<div class="font-medium">
							{{ user.name || `@${user.username}` }}
						</div>
						<div class="text-xs text-gray-500">
							@{{ user.username
							}}<span v-if="user.name"> · {{ user.phone }}</span>
						</div>
					</button>
				</div>
			</div>
		</div>

		<div class="flex-1 min-h-0 overflow-y-auto">
			<div v-if="store.isLoading" class="p-4 text-sm text-gray-500">
				Загрузка...
			</div>

			<div v-else-if="filtered.length === 0" class="p-4 text-sm text-gray-500">
				Пока нет чатов
			</div>

			<button
				v-else
				v-for="chat in filtered"
				:key="chat.id"
				class="w-full text-left px-3 py-3 border-b hover:bg-gray-50"
				:class="chat.id === store.activeChatId ? 'bg-gray-50' : ''"
				@click="openChat(chat.id)"
			>
				<div class="flex items-center gap-3">
					<div
						class="w-11 h-11 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 shrink-0"
					>
						<img
							v-if="chat.otherUser?.avatarUrl"
							:src="fileUrl(chat.otherUser.avatarUrl)"
							alt="avatar"
							class="w-full h-full object-cover"
						/>
						<span v-else>{{ avatarLetter(chat.otherUser || chat) }}</span>
					</div>

					<div class="flex-1 min-w-0 flex items-center justify-between gap-3">
						<div class="min-w-0">
							<div class="font-medium truncate">{{ chat.title }}</div>
							<div class="text-sm text-gray-500 truncate">
								{{ chat.lastMessageText || 'Нет сообщений' }}
							</div>
						</div>

						<div class="flex flex-col items-end gap-1">
							<div class="text-xs text-gray-400 whitespace-nowrap">
								{{ formatTime(chat.lastMessageAt) }}
							</div>

							<div
								v-if="chat.unreadCount > 0"
								class="min-w-[20px] h-5 px-2 rounded-full bg-black text-white text-xs flex items-center justify-center"
							>
								{{ chat.unreadCount }}
							</div>
						</div>
					</div>
				</div>
			</button>
		</div>
	</aside>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, fileUrl } from '../../api/http'
import { useChatStore } from '../../stores/chat'

const store = useChatStore()
const router = useRouter()

const query = ref('')

const userSearch = ref('')
const userSearchResults = ref([])
const isSearchingUsers = ref(false)
const userSearchError = ref('')

let searchTimer = null

const normalizedSearch = computed(() =>
	userSearch.value.trim().replace(/^@+/, '').toLowerCase(),
)

const filtered = computed(() => {
	const q = query.value.trim().toLowerCase()
	if (!q) return store.chats
	return store.chats.filter(c => (c.title || '').toLowerCase().includes(q))
})

function formatTime(iso) {
	if (!iso) return ''
	try {
		const d = new Date(iso)
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
	} catch {
		return ''
	}
}

function avatarLetter(userOrChat) {
	const source =
		userOrChat?.name ||
		userOrChat?.title ||
		userOrChat?.username ||
		userOrChat?.phone ||
		'?'

	return String(source).trim().slice(0, 1).toUpperCase()
}

async function searchUsersNow() {
	const q = normalizedSearch.value

	if (!q || q.length < 2) {
		userSearchResults.value = []
		userSearchError.value = ''
		return
	}

	try {
		isSearchingUsers.value = true
		userSearchError.value = ''

		const data = await api(`/profile/search?q=${encodeURIComponent(q)}`)
		userSearchResults.value = data.users || []
	} catch (e) {
		userSearchError.value = e.message
	} finally {
		isSearchingUsers.value = false
	}
}

function onSearchUsers() {
	if (searchTimer) clearTimeout(searchTimer)
	searchTimer = setTimeout(() => {
		searchUsersNow()
	}, 250)
}

function openChat(chatId) {
	router.push(`/chat/${chatId}`)
}

async function openDirectByUsername(username) {
	if (!username) return

	try {
		const data = await api('/chats/direct/by-username', {
			method: 'POST',
			body: { username },
		})

		userSearch.value = ''
		userSearchResults.value = []
		userSearchError.value = ''

		await store.loadChats()
		store.setActiveChat(data.chatId)
	} catch (e) {
		userSearchError.value = e.message
	}
}
</script>
