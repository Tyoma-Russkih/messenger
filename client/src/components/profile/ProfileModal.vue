<template>
	<Teleport to="body">
		<div
			v-if="open"
			class="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center p-4"
			@click="$emit('close')"
		>
			<div
				class="w-full max-w-md rounded-2xl bg-white shadow-2xl p-5"
				@click.stop
			>
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-semibold">Мой профиль</h2>

					<button
						type="button"
						class="text-gray-400 hover:text-black"
						@click="$emit('close')"
					>
						✕
					</button>
				</div>

				<div class="mt-4 space-y-4">
					<div class="flex items-center gap-4">
						<div
							class="w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-gray-500 text-xl font-semibold"
						>
							<img
								v-if="auth.user?.avatarUrl"
								:src="fileUrl(auth.user.avatarUrl)"
								alt="avatar"
								class="w-full h-full object-cover"
							/>
							<span v-else>
								{{
									(
										auth.user?.name ||
										auth.user?.username ||
										auth.user?.phone ||
										'?'
									)
										.slice(0, 1)
										.toUpperCase()
								}}
							</span>
						</div>

						<div class="flex-1">
							<input
								ref="avatarInput"
								type="file"
								accept="image/*"
								class="hidden"
								@change="onPickAvatar"
							/>

							<button
								type="button"
								class="rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
								:disabled="isUploadingAvatar"
								@click="openAvatarPicker"
							>
								{{ isUploadingAvatar ? 'Загрузка...' : 'Загрузить аватар' }}
							</button>
						</div>
					</div>

					<div>
						<label class="block text-sm text-gray-600">Имя</label>
						<input
							v-model="form.name"
							class="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
							placeholder="Например, Иван"
						/>
					</div>

					<div>
						<label class="block text-sm text-gray-600">Username</label>

						<div class="mt-1 flex items-center rounded-xl border px-3">
							<span class="text-gray-400">@</span>
							<input
								v-model="form.username"
								class="w-full py-2 outline-none"
								placeholder="username"
							/>
						</div>

						<div class="mt-1 text-xs text-gray-500">
							5–32 символа: a-z, 0-9 и _
						</div>
					</div>

					<div>
						<label class="block text-sm text-gray-600">О себе</label>
						<textarea
							v-model="form.bio"
							rows="4"
							class="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10 resize-none"
							placeholder="Немного о себе"
						/>
					</div>

					<div class="rounded-xl bg-gray-50 px-3 py-2 text-sm">
						<div>
							<span class="text-gray-500">Телефон:</span>
							{{ auth.user?.phone }}
						</div>
					</div>

					<div v-if="error" class="text-sm text-red-600">
						{{ error }}
					</div>

					<div class="flex justify-end gap-2">
						<button
							type="button"
							class="rounded-xl border px-4 py-2 hover:bg-gray-50"
							@click="$emit('close')"
						>
							Отмена
						</button>

						<button
							type="button"
							class="rounded-xl bg-black text-white px-4 py-2 hover:opacity-90 disabled:opacity-50"
							:disabled="isSaving"
							@click="save"
						>
							Сохранить
						</button>
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { api, fileUrl } from '../../api/http'
import { useAuthStore } from '../../stores/auth'

const props = defineProps({
	open: Boolean,
})

const emit = defineEmits(['close', 'saved'])

const auth = useAuthStore()

const isSaving = ref(false)
const error = ref('')

const isUploadingAvatar = ref(false)
const avatarInput = ref(null)

const form = reactive({
	name: '',
	username: '',
	bio: '',
})

watch(
	() => props.open,
	open => {
		if (!open) return

		form.name = auth.user?.name || ''
		form.username = auth.user?.username || ''
		form.bio = auth.user?.bio || ''
		error.value = ''
	},
	{ immediate: true },
)

function openAvatarPicker() {
	avatarInput.value?.click()
}

async function onPickAvatar(e) {
	const file = e.target.files?.[0]
	if (!file) return

	try {
		isUploadingAvatar.value = true
		error.value = ''

		const formData = new FormData()
		formData.append('avatar', file)

		const token = localStorage.getItem('token')

		const res = await fetch(
			`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/profile/me/avatar`,
			{
				method: 'POST',
				headers: token ? { Authorization: `Bearer ${token}` } : {},
				body: formData,
			},
		)

		const data = await res.json().catch(() => ({}))
		if (!res.ok) throw new Error(data.message || 'Не удалось загрузить аватар')

		auth.user = data.user
	} catch (e2) {
		error.value = e2.message
	} finally {
		isUploadingAvatar.value = false
		if (avatarInput.value) avatarInput.value.value = ''
	}
}

async function save() {
	try {
		isSaving.value = true
		error.value = ''

		const data = await api('/profile/me', {
			method: 'PATCH',
			body: {
				name: form.name,
				username: form.username,
				bio: form.bio,
			},
		})

		auth.user = data.user
		emit('saved', data.user)
		emit('close')
	} catch (e) {
		error.value = e.message
	} finally {
		isSaving.value = false
	}
}
</script>
