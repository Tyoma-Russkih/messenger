<template>
	<section class="h-full min-h-0 bg-gray-50">
		<div v-if="!chat" class="h-full flex items-center justify-center p-6">
			<div class="text-center">
				<div class="text-lg font-semibold">Выберите чат</div>
				<div class="text-sm text-gray-500 mt-1">
					Слева выбери чат, чтобы открыть переписку.
				</div>
			</div>
		</div>

		<div v-else class="h-full min-h-0 flex flex-col">
			<!-- Header -->
			<div
				class="h-14 shrink-0 bg-white border-b px-4 flex items-center justify-between"
			>
				<div class="min-w-0 flex items-center gap-3">
					<div
						class="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 shrink-0"
					>
						<img
							v-if="chat.otherUser?.avatarUrl"
							:src="fileUrl(chat.otherUser.avatarUrl)"
							alt="avatar"
							class="w-full h-full object-cover"
						/>
						<span v-else>{{ avatarLetter(chat.otherUser || chat) }}</span>
					</div>

					<div class="min-w-0">
						<button
							class="font-semibold truncate hover:underline text-left"
							@click="openUserProfile"
						>
							{{ chat.title }}
						</button>

						<div class="text-xs text-gray-500">
							<span v-if="store.isTyping">Печатает…</span>
							<template v-else>
								<span v-if="isOnline">в сети</span>
								<span v-else-if="lastSeen"
									>был(а) в {{ formatTime(lastSeen) }}</span
								>
							</template>
						</div>
					</div>
				</div>

				<button class="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50">
					⋯
				</button>
			</div>

			<!-- Messages -->
			<!-- Messages wrapper (НЕ скроллится) -->
			<div class="relative flex-1 min-h-0">
				<!-- Scroll area (скроллится) -->
				<div ref="messagesEl" class="h-full overflow-y-auto p-4">
					<div v-if="isLoading" class="text-sm text-gray-500">Загрузка...</div>
					<div v-else-if="error" class="text-sm text-red-600">{{ error }}</div>

					<div v-else class="min-h-full flex flex-col justify-end">
						<div v-if="messages.length === 0" class="text-sm text-gray-500">
							Нет сообщений. Напиши первое 🙂
						</div>

						<div v-else class="space-y-2">
							<template v-for="(m, i) in messages" :key="m.id">
								<!-- date divider -->
								<div v-if="shouldShowDate(i)" class="flex justify-center my-3">
									<div
										class="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded-full"
									>
										{{ getDayLabel(m.createdAt) }}
									</div>
								</div>

								<!-- message -->
								<div
									class="flex items-start gap-2 group w-full px-2"
									:class="isMine(m) ? 'justify-end' : 'justify-start'"
								>
									<!-- menu button слева у исходящих -->
									<div v-if="isMine(m)" class="shrink-0">
										<button
											type="button"
											:class="[
												'w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm self-center',
												openedMenuId === m.id
													? 'bg-gray-200 text-black opacity-100'
													: 'bg-white text-gray-500 hover:text-black hover:bg-gray-100 opacity-0 group-hover:opacity-100',
											]"
											data-message-menu-trigger
											@click.stop="toggleMessageMenu($event, m)"
										>
											<MoreHorizontal class="w-4 h-4" stroke-width="2" />
										</button>
									</div>

									<!-- bubble -->
									<div
										:data-message-id="m.id"
										class="max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm transition-all duration-300"
										:class="[
											isMine(m) ? 'bg-black text-white' : 'bg-white border',
											highlightedMessageId === m.id
												? isMine(m)
													? 'ring-2 ring-white/40 scale-[1.02]'
													: 'ring-2 ring-black/20 scale-[1.02]'
												: '',
										]"
									>
										<button
											v-if="m.replyTo || m.replyPreviewText"
											type="button"
											class="mb-1 w-full text-left px-2 py-1 rounded text-xs transition hover:opacity-90 cursor-pointer"
											:class="isMine(m) ? 'bg-white/10' : 'bg-gray-100'"
											@click="m.replyTo && scrollToMessage(m.replyTo.id)"
										>
											<div class="font-semibold">
												{{
													m.replyTo?.sender?.phone || m.replyPreviewSenderPhone
												}}
											</div>
											<div class="truncate opacity-80">
												{{ m.replyTo?.text || m.replyPreviewText }}
											</div>
										</button>

										<template v-if="m.type === 'IMAGE' && m.fileUrl">
											<button
												type="button"
												class="block rounded-xl overflow-hidden bg-black/5"
												@click="openImagePreview(m)"
											>
												<img
													:src="fileUrl(m.fileUrl)"
													:alt="m.fileName || 'image'"
													class="block max-w-[260px] max-h-[260px] w-auto h-auto object-cover"
													loading="lazy"
													@load="onImageLoad"
													@error="
														e => {
															console.log(
																'IMAGE LOAD ERROR',
																m,
																fileUrl(m.fileUrl),
															)
															onImageError(e)
														}
													"
												/>
											</button>
										</template>

										<template v-else-if="m.type === 'FILE' && m.fileUrl">
											<a
												:href="fileUrl(m.fileUrl)"
												target="_blank"
												rel="noreferrer"
												class="flex items-center gap-3 rounded-xl border px-3 py-2 hover:bg-black/5"
												:class="
													isMine(m) ? 'border-white/20' : 'border-gray-200'
												"
											>
												<FileIcon class="w-5 h-5 shrink-0" stroke-width="2" />
												<div class="min-w-0">
													<div class="truncate">{{ m.fileName || 'Файл' }}</div>
													<div class="text-xs opacity-70">
														{{ formatFileSize(m.fileSize) }}
													</div>
												</div>
											</a>
										</template>

										<template v-else>
											<div class="whitespace-pre-wrap break-words">
												{{ m.text }}
											</div>
										</template>

										<div
											class="mt-1 text-[11px] opacity-70 flex items-center gap-1 justify-end"
										>
											<span v-if="m.editedAt">изменено</span>
											<span>{{ formatTime(m.createdAt) }}</span>

											<span v-if="isMine(m)">
												<Check
													v-if="!isRead(m)"
													class="w-3.5 h-3.5 text-gray-400"
													stroke-width="2"
												/>
												<CheckCheck
													v-else
													class="w-3.5 h-3.5 text-blue-500"
													stroke-width="2"
												/>
											</span>
										</div>
									</div>

									<!-- menu button справа у входящих -->
									<div v-if="!isMine(m)" class="shrink-0">
										<button
											type="button"
											:class="[
												'w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm self-center',
												openedMenuId === m.id
													? 'bg-gray-200 text-black opacity-100'
													: 'bg-white text-gray-500 hover:text-black hover:bg-gray-100 opacity-0 group-hover:opacity-100',
											]"
											data-message-menu-trigger
											@click.stop="toggleMessageMenu($event, m)"
										>
											<MoreHorizontal class="w-4 h-4" stroke-width="2" />
										</button>
									</div>
								</div>
								<Teleport to="body">
									<div
										v-if="openedMenuId && activeMenuMessage"
										data-message-menu
										class="fixed w-44 rounded-xl border bg-white py-1 z-[100] overflow-hidden"
										:style="{
											top: `${menuPosition.top}px`,
											left: `${menuPosition.left}px`,
										}"
									>
										<button
											type="button"
											class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
											@click="onReply(activeMenuMessage)"
										>
											<CornerUpLeft class="w-4 h-4 text-gray-500" />
											<span>Ответить</span>
										</button>

										<button
											v-if="isMine(activeMenuMessage)"
											type="button"
											class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
											@click="onEdit(activeMenuMessage)"
										>
											<Pencil class="w-4 h-4 text-gray-500" />
											<span>Редактировать</span>
										</button>

										<button
											v-if="isMine(activeMenuMessage)"
											type="button"
											class="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50 flex items-center gap-2"
											@click="onDelete(activeMenuMessage)"
										>
											<Trash2 class="w-4 h-4" />
											<span>Удалить</span>
										</button>
									</div>
								</Teleport>
							</template>
						</div>

						<!-- anchor -->
						<div ref="bottomAnchor" class="h-2"></div>
					</div>
				</div>

				<!-- ✅ Jump down button (НЕ скроллится) -->
				<button
					v-if="showJumpDown"
					class="absolute right-4 bottom-4 w-10 h-10 rounded-full bg-black text-white shadow-md hover:scale-105 active:scale-95 transition flex items-center justify-center"
					type="button"
					@click="onJumpDown"
				>
					<ArrowDown class="w-4 h-4" stroke-width="2.5" />

					<span
						v-if="newMessagesCount > 0"
						class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center"
					>
						{{ newMessagesCount }}
					</span>
				</button>
			</div>

			<!-- Composer -->
			<div class="bg-white border-t p-3 shrink-0">
				<div
					v-if="replyTo"
					class="mb-2 px-3 py-2 bg-gray-100 rounded-lg text-xs flex justify-between items-center"
				>
					<div>
						<div class="font-semibold">
							{{ replyTo.sender?.phone || 'Сообщение' }}
						</div>
						<div class="text-gray-500 truncate">
							{{ replyTo.text }}
						</div>
					</div>

					<button
						class="text-gray-400 hover:text-black"
						@click="replyTo = null"
					>
						✕
					</button>
				</div>
				<div
					v-if="editingMessage"
					class="mb-2 px-3 py-2 bg-gray-100 rounded-lg text-xs flex justify-between items-center"
				>
					<div>
						<div class="font-semibold">Редактирование сообщения</div>
						<div class="text-gray-500 truncate">
							{{ editingMessage.text }}
						</div>
					</div>

					<button
						type="button"
						class="text-gray-400 hover:text-black"
						@click="cancelEdit"
					>
						✕
					</button>
				</div>
				<form class="flex gap-2" @submit.prevent="send">
					<input
						ref="fileInput"
						type="file"
						class="hidden"
						@change="onPickFile"
					/>

					<button
						type="button"
						class="rounded-xl border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
						:disabled="isUploading"
						@click="openFilePicker"
					>
						<Paperclip class="w-4 h-4" stroke-width="2" />
					</button>
					<input
						ref="messageInput"
						:value="editingMessage ? editText : text"
						@input="handleInput"
						class="flex-1 rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
						placeholder="Сообщение"
					/>
					<button
						class="rounded-xl bg-black text-white px-4 py-2 hover:opacity-90 disabled:opacity-50"
						:disabled="
							isUploading ||
							(editingMessage
								? !editText.trim() || !isEditChanged
								: !text.trim())
						"
					>
						{{ editingMessage ? 'Сохранить' : 'Отправить' }}
					</button>
				</form>
			</div>
		</div>
	</section>
	<Teleport to="body">
		<div
			v-if="previewImage"
			class="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-6"
			@click="closeImagePreview"
		>
			<div class="max-w-[90vw] max-h-[90vh]" @click.stop>
				<img
					:src="previewImage.url"
					:alt="previewImage.name"
					class="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
				/>

				<div class="mt-3 flex items-center justify-between text-white text-sm">
					<div class="truncate pr-4">
						{{ previewImage.name }}
					</div>

					<button
						type="button"
						class="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10"
						@click="closeImagePreview"
					>
						Закрыть
					</button>
				</div>
			</div>
		</div>
	</Teleport>
	<UserProfileModal
		:open="isUserProfileOpen"
		:user="chat?.otherUser"
		:isOnline="isOnline"
		@close="isUserProfileOpen = false"
	/>
</template>

<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
	Check,
	CheckCheck,
	ArrowDown,
	MoreHorizontal,
	CornerUpLeft,
	Pencil,
	Trash2,
	ImageIcon,
	Paperclip,
	File as FileIcon,
} from 'lucide-vue-next'
import { api, fileUrl } from '../../api/http'
import { useChatStore } from '../../stores/chat'
import { useAuthStore } from '../../stores/auth'
import { connectSocket, getSocket } from '../../realtime/socket'
import UserProfileModal from '../profile/UserProfileModal.vue'

const store = useChatStore()
const auth = useAuthStore()

const chat = computed(() => store.activeChat)

const text = ref('')
const messages = ref([])
const hasMore = ref(true)
const isLoadingMore = ref(false)
const isLoading = ref(false)
const error = ref('')

const isUserProfileOpen = ref(false)

const messagesEl = ref(null)
const bottomAnchor = ref(null)

const isAtBottom = ref(true)
const newMessagesCount = ref(0)
const showJumpDown = ref(false)

const replyTo = ref(null)

const editingMessage = ref(null)
const editText = ref('')

const openedMenuId = ref(null)

const highlightedMessageId = ref(null)

const messageInput = ref(null)

const fileInput = ref(null)
const isUploading = ref(false)

const previewImage = ref(null)

const activeMenuMessage = ref(null)
const menuPosition = ref({ top: 0, left: 0 })
const MENU_WIDTH = 176
const MENU_HEIGHT = 112

let typingTimer = null
let typingSent = false

const isEditChanged = computed(() => {
	if (!editingMessage.value) return true
	return editText.value.trim() !== editingMessage.value.text.trim()
})

const otherUser = computed(() => {
	if (!chat.value || chat.value.type !== 'DIRECT') return null
	return chat.value.otherUser
})

const isOnline = computed(() => {
	if (!otherUser.value) return false
	return store.onlineUsers[otherUser.value.id]?.online
})

const lastSeen = computed(() => {
	if (!otherUser.value) return null
	const data = store.onlineUsers[otherUser.value.id]
	if (data?.lastSeenAt) return data.lastSeenAt
	return otherUser.value.lastSeenAt
})

async function startEdit(message) {
	if (!isMine(message)) return

	editingMessage.value = message
	editText.value = message.text

	await nextTick()

	const input = messageInput.value
	if (!input) return

	input.focus()

	const len = input.value.length
	input.setSelectionRange(len, len)
}

function cancelEdit() {
	editingMessage.value = null
	editText.value = ''
}

function toggleMessageMenu(event, message) {
	event.stopPropagation()

	if (openedMenuId.value === message.id) {
		closeMessageMenu()
		return
	}

	const rect = event.currentTarget.getBoundingClientRect()

	let left = isMine(message)
		? rect.left - MENU_WIDTH - 8 // у исходящих — слева
		: rect.right + 8 // у входящих — справа

	let top = rect.top - 4

	// чтобы не уезжало за экран
	left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8))
	top = Math.max(8, Math.min(top, window.innerHeight - MENU_HEIGHT - 8))

	openedMenuId.value = message.id
	activeMenuMessage.value = message
	menuPosition.value = { top, left }
}

function closeMessageMenu() {
	openedMenuId.value = null
	activeMenuMessage.value = null
}

function onReply(message) {
	replyTo.value = message
	closeMessageMenu()
}

function onEdit(message) {
	startEdit(message)
	closeMessageMenu()
}

async function onDelete(message) {
	closeMessageMenu()
	await deleteMessage(message)
}

async function deleteMessage(message) {
	closeMessageMenu()
	if (!isMine(message)) return

	try {
		await api(`/chats/messages/${message.id}`, {
			method: 'DELETE',
		})

		messages.value = messages.value.filter(m => m.id !== message.id)

		if (editingMessage.value?.id === message.id) {
			cancelEdit()
		}

		if (replyTo.value?.id === message.id) {
			replyTo.value = null
		}

		store.loadChats()
	} catch (e) {
		error.value = e.message
	}
}

function handleWindowClick(e) {
	const menu = e.target.closest?.('[data-message-menu]')
	const trigger = e.target.closest?.('[data-message-menu-trigger]')
	if (!menu && !trigger) {
		closeMessageMenu()
	}
}

function openFilePicker() {
	fileInput.value?.click()
}

async function onPickFile(e) {
	const file = e.target.files?.[0]
	if (!file) return

	const chatId = store.activeChatId
	if (!chatId) return

	try {
		isUploading.value = true

		const formData = new FormData()
		formData.append('file', file)
		if (replyTo.value?.id) {
			formData.append('replyToId', replyTo.value.id)
		}

		const token = localStorage.getItem('token')
		const res = await fetch(
			`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/chats/${chatId}/files`,
			{
				method: 'POST',
				headers: token ? { Authorization: `Bearer ${token}` } : {},
				body: formData,
			},
		)

		const data = await res.json().catch(() => ({}))
		if (!res.ok) throw new Error(data.message || 'Upload failed')

		replyTo.value = null

		if (!messages.value.some(m => m.id === data.message.id)) {
			messages.value.push(data.message)
		}

		await scrollToBottom(true)
		store.loadChats()
	} catch (e2) {
		error.value = e2.message
	} finally {
		isUploading.value = false
		if (fileInput.value) fileInput.value.value = ''
	}
}

function formatFileSize(size) {
	if (!size && size !== 0) return ''
	if (size < 1024) return `${size} Б`
	if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`
	return `${(size / (1024 * 1024)).toFixed(1)} МБ`
}

function onImageLoad() {
	if (isAtBottom.value) {
		scrollToBottom(false)
	}
}

function onMessageDeleted(payload) {
	const chatId = payload?.chatId
	const messageId = payload?.messageId
	if (!chatId || !messageId) return
	if (chatId !== store.activeChatId) return

	messages.value = messages.value.filter(m => m.id !== messageId)

	if (editingMessage.value?.id === messageId) {
		cancelEdit()
	}

	if (replyTo.value?.id === messageId) {
		replyTo.value = null
	}
}

function openUserProfile() {
	if (!chat?.value?.otherUser) return
	isUserProfileOpen.value = true
}

function openImagePreview(message) {
	if (!message?.fileUrl) return
	previewImage.value = {
		url: fileUrl(message.fileUrl),
		name: message.fileName || 'Изображение',
	}
}

function closeImagePreview() {
	previewImage.value = null
}

function onImageError(e) {
	const img = e.target
	if (!img) return

	img.style.display = 'none'

	const wrapper = img.parentElement
	if (!wrapper) return

	const fallback = document.createElement('div')
	fallback.className =
		'w-[220px] h-[160px] flex items-center justify-center text-xs text-gray-500 bg-gray-100'
	fallback.textContent = 'Не удалось загрузить изображение'

	if (!wrapper.querySelector('[data-image-fallback]')) {
		fallback.setAttribute('data-image-fallback', 'true')
		wrapper.appendChild(fallback)
	}
}

function onMessageUpdated(payload) {
	const message = payload?.message
	const chatId = payload?.chatId
	if (!message || !chatId) return
	if (chatId !== store.activeChatId) return

	const i = messages.value.findIndex(m => m.id === message.id)
	if (i !== -1) {
		messages.value[i] = message
	}
}

function emitTyping(isTyping) {
	const s = getSocket()
	if (!s) return
	const chatId = store.activeChatId
	if (!chatId) return
	s.emit(isTyping ? 'typing:start' : 'typing:stop', { chatId })
}

function onInputTyping() {
	// если только начали печатать
	if (!typingSent) {
		typingSent = true
		emitTyping(true)
	}

	// сброс таймера
	if (typingTimer) clearTimeout(typingTimer)
	typingTimer = setTimeout(() => {
		typingSent = false
		emitTyping(false)
	}, 900)
}

function isMine(msg) {
	return msg.senderId === auth.user?.id
}

function formatTime(iso) {
	try {
		return new Date(iso).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		})
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

function handleInput(e) {
	const value = e.target.value

	if (editingMessage.value) {
		editText.value = value
	} else {
		text.value = value
		onInputTyping()
	}
}

function isRead(m) {
	const receipts = m.receipts || []
	return receipts.some(r => !!r.readAt)
}

function ensureReceipt(message, userId) {
	if (!message.receipts) message.receipts = []
	let r = message.receipts.find(x => x.userId === userId)
	if (!r) {
		r = { userId, deliveredAt: null, readAt: null }
		message.receipts.push(r)
	}
	return r
}

function applyDelivered({ chatId, messageId, userId, deliveredAt }) {
	if (chatId !== store.activeChatId) return
	const msg = messages.value.find(m => m.id === messageId)
	if (!msg) return
	const r = ensureReceipt(msg, userId)
	if (!r.deliveredAt) r.deliveredAt = deliveredAt || new Date().toISOString()
}

function applyRead({ chatId, userId, lastMessageId, readAt }) {
	if (chatId !== store.activeChatId) return
	const target = messages.value.find(m => m.id === lastMessageId)
	if (!target) return

	const cutoff = new Date(target.createdAt).getTime()
	const ts = readAt || new Date().toISOString()

	// отмечаем прочитанными мои сообщения до последнего прочитанного включительно
	for (const m of messages.value) {
		if (!isMine(m)) continue
		const t = new Date(m.createdAt).getTime()
		if (t <= cutoff) {
			const r = ensureReceipt(m, userId)
			if (!r.readAt) r.readAt = ts
		}
	}
}

function getDayLabel(dateString) {
	const d = new Date(dateString)
	const today = new Date()
	const yesterday = new Date()
	yesterday.setDate(today.getDate() - 1)

	const isSame = (a, b) =>
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()

	if (isSame(d, today)) return 'Сегодня'
	if (isSame(d, yesterday)) return 'Вчера'
	return d.toLocaleDateString()
}

function shouldShowDate(index) {
	if (index === 0) return true
	const prev = messages.value[index - 1]
	const curr = messages.value[index]
	const a = new Date(prev.createdAt)
	const b = new Date(curr.createdAt)
	return (
		a.getFullYear() !== b.getFullYear() ||
		a.getMonth() !== b.getMonth() ||
		a.getDate() !== b.getDate()
	)
}

function updateIsAtBottom() {
	const el = messagesEl.value
	if (!el) return

	const dist = el.scrollHeight - (el.scrollTop + el.clientHeight)

	isAtBottom.value = dist <= 20
	showJumpDown.value = dist > 50

	if (isAtBottom.value) {
		newMessagesCount.value = 0
	}
}

function onScroll() {
	updateIsAtBottom()

	const el = messagesEl.value
	if (!el) return

	// если почти вверху — грузим старые
	if (el.scrollTop <= 20) {
		loadOlder()
	}
}

async function scrollToBottom(smooth) {
	await nextTick()
	const anchor = bottomAnchor.value
	if (!anchor) return
	anchor.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' })
	newMessagesCount.value = 0
	if (messages.value.length) {
		const lastId = messages.value[messages.value.length - 1].id
		markChatRead(lastId)
	}
}

async function scrollToMessage(messageId) {
	if (!messageId) return

	const findInDom = () => {
		const root = messagesEl.value
		if (!root) return null
		return root.querySelector(`[data-message-id="${messageId}"]`)
	}

	await nextTick()

	let el = findInDom()

	// если ещё не загружено — догружаем старые страницы
	while (!el && hasMore.value) {
		const result = await loadOlder()

		// защита от бесконечного цикла
		if (!result || result.added === 0) break

		await nextTick()
		el = findInDom()
	}

	if (!el) return

	el.scrollIntoView({ behavior: 'smooth', block: 'center' })

	highlightedMessageId.value = messageId

	setTimeout(() => {
		if (highlightedMessageId.value === messageId) {
			highlightedMessageId.value = null
		}
	}, 1600)
}

async function onJumpDown() {
	await scrollToBottom(true)
	newMessagesCount.value = 0

	// если у тебя уже есть markChatRead — оставь эту часть,
	// если нет — просто удали 4 строки ниже
}

async function markChatRead(lastMessageId) {
	const chatId = store.activeChatId
	if (!chatId || !lastMessageId) return

	try {
		await api(`/chats/${chatId}/read`, {
			method: 'POST',
			body: { lastMessageId },
		})
	} catch {}
}

async function loadMessages(chatId) {
	error.value = ''
	isLoading.value = true
	isLoadingMore.value = false
	hasMore.value = true
	newMessagesCount.value = 0

	try {
		const data = await api(`/chats/${chatId}/messages?take=50`)
		messages.value = data.messages || []
		hasMore.value = !!data.hasMore
	} catch (e) {
		error.value = e.message
	} finally {
		isLoading.value = false
		// мгновенно вниз при открытии
		await scrollToBottom(false)
		updateIsAtBottom()
		if (messages.value.length) {
			const lastId = messages.value[messages.value.length - 1].id
			markChatRead(lastId)
		}
	}
}

async function loadOlder() {
	const chatId = store.activeChatId
	if (!chatId) return { added: 0, hasMore: hasMore.value }
	if (!hasMore.value || isLoadingMore.value)
		return { added: 0, hasMore: hasMore.value }
	if (messages.value.length === 0) return { added: 0, hasMore: hasMore.value }

	isLoadingMore.value = true

	const el = messagesEl.value
	const prevScrollHeight = el ? el.scrollHeight : 0
	const prevScrollTop = el ? el.scrollTop : 0

	const oldestId = messages.value[0].id

	try {
		const data = await api(
			`/chats/${chatId}/messages?take=50&cursor=${oldestId}`,
		)
		const older = data.messages || []

		const existing = new Set(messages.value.map(m => m.id))
		const toAdd = older.filter(m => !existing.has(m.id))

		messages.value = [...toAdd, ...messages.value]
		hasMore.value = !!data.hasMore

		await nextTick()

		if (el) {
			const newScrollHeight = el.scrollHeight
			const delta = newScrollHeight - prevScrollHeight
			el.scrollTop = prevScrollTop + delta
		}

		return { added: toAdd.length, hasMore: hasMore.value }
	} catch (e) {
		console.log('loadOlder error:', e.message)
		return { added: 0, hasMore: hasMore.value }
	} finally {
		isLoadingMore.value = false
	}
}

watch(
	() => store.activeChatId,
	id => {
		messages.value = []
		newMessagesCount.value = 0
		replyTo.value = null
		openedMenuId.value = null
		if (typingTimer) clearTimeout(typingTimer)
		typingTimer = null
		typingSent = false
		emitTyping(false)

		if (id) loadMessages(id)
	},
	{ immediate: true },
)

// realtime
let socket = null

function onNewMessage(payload) {
	const msg = payload?.message
	const chatId = payload?.chatId
	if (!chatId || !msg) return
	if (chatId !== store.activeChatId) return

	if (messages.value.some(m => m.id === msg.id)) return

	messages.value.push(msg)

	if (isAtBottom.value) {
		scrollToBottom(true)
		markChatRead(msg.id)
	} else {
		// увеличиваем только если сообщение НЕ моё
		if (!isMine(msg)) newMessagesCount.value += 1
	}
	api(`/chats/${store.activeChatId}/read`, {
		method: 'POST',
		body: { lastMessageId: msg.id },
	}).catch(() => {})
}

onMounted(() => {
	const el = messagesEl.value
	if (el) el.addEventListener('scroll', onScroll, { passive: true })

	window.addEventListener('click', handleWindowClick)
	window.addEventListener('click', handleWindowClick)
	window.addEventListener('resize', closeMessageMenu)
	window.addEventListener('scroll', closeMessageMenu, true)

	socket = connectSocket()
	if (!socket) return

	socket.off('message:new', onNewMessage)
	socket.on('message:new', onNewMessage)
	socket.off('message:delivered', applyDelivered)
	socket.off('message:read', applyRead)
	socket.on('message:delivered', applyDelivered)
	socket.on('message:read', applyRead)

	socket.off('message:updated', onMessageUpdated)
	socket.on('message:updated', onMessageUpdated)

	socket.off('message:deleted', onMessageDeleted)
	socket.on('message:deleted', onMessageDeleted)
})

onBeforeUnmount(() => {
	const el = messagesEl.value
	if (el) el.removeEventListener('scroll', onScroll)

	window.addEventListener('click', handleWindowClick)
	window.removeEventListener('click', handleWindowClick)
	window.removeEventListener('resize', closeMessageMenu)
	window.removeEventListener('scroll', closeMessageMenu, true)

	if (!socket) return
	socket.off('message:new', onNewMessage)
	socket.off('message:delivered', applyDelivered)
	socket.off('message:read', applyRead)
	socket.off('message:updated', onMessageUpdated)
	socket.off('message:deleted', onMessageDeleted)
})

async function send() {
	closeMessageMenu()
	const chatId = store.activeChatId
	if (!chatId) return

	// режим редактирования
	if (editingMessage.value) {
		const t = editText.value.trim()
		if (!t) return

		try {
			const data = await api(`/chats/messages/${editingMessage.value.id}`, {
				method: 'PATCH',
				body: { text: t },
			})

			const i = messages.value.findIndex(m => m.id === editingMessage.value.id)
			if (i !== -1) {
				messages.value[i] = data.message
			}

			cancelEdit()
			store.loadChats()
		} catch (e) {
			error.value = e.message
		}
		return
	}

	// обычная отправка
	const t = text.value.trim()
	if (!t) return

	if (typingTimer) clearTimeout(typingTimer)
	typingTimer = null
	typingSent = false
	emitTyping(false)

	text.value = ''
	try {
		const data = await api(`/chats/${chatId}/messages`, {
			method: 'POST',
			body: {
				text: t,
				replyToId: replyTo.value?.id || null,
			},
		})

		replyTo.value = null

		if (!messages.value.some(m => m.id === data.message.id)) {
			messages.value.push(data.message)
		}

		await scrollToBottom(true)
		store.loadChats()
	} catch (e) {
		error.value = e.message
	}
}
</script>
