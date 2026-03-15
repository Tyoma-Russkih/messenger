<template>
	<div class="min-h-screen flex items-center justify-center p-6">
		<div class="w-full max-w-sm rounded-2xl border p-6 shadow-sm bg-white">
			<h1 class="text-xl font-semibold">Вход</h1>

			<p class="text-sm text-gray-500 mt-1" v-if="auth.step === 'phone'">
				Введите номер телефона — пришлём код.
			</p>
			<p class="text-sm text-gray-500 mt-1" v-else>
				Введите 6-значный код, отправленный на
				{{ auth.phoneMasked || 'ваш номер' }}.
			</p>

			<div class="mt-6" v-if="auth.step === 'phone'">
				<label class="block text-sm font-medium">Телефон</label>
				<input
					v-maska="'+7 (###) ###-##-##'"
					v-model="phone"
					type="tel"
					inputmode="tel"
					autocomplete="tel"
					placeholder="+7 (___) ___-__-__"
					class="mt-2 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
				/>

				<button
					class="mt-4 w-full rounded-xl bg-black text-white py-2 hover:opacity-90 disabled:opacity-50"
					:disabled="!isPhoneValid"
					@click="requestCode"
				>
					Получить код
				</button>
			</div>

			<div class="mt-6" v-else>
				<CodeSquares
					ref="codeRef"
					:length="6"
					:model-value="code"
					:error="codeError"
					@update:model-value="onCodeUpdate"
					@complete="verifyCode"
				/>

				<div class="mt-4 flex items-center justify-between">
					<button
						class="text-sm text-gray-600 hover:underline"
						@click="auth.goToPhone()"
					>
						Изменить номер
					</button>
					<button
						class="text-sm text-gray-600 hover:underline"
						@click="resendCode"
					>
						Отправить ещё раз
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { nextTick, computed, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { api } from '../api/http'
import CodeSquares from '../ui/CodeSquares.vue'

const auth = useAuthStore()

const phone = ref(auth.phoneMasked || '')
const code = ref(auth.code || '')
const error = ref('')
const codeError = ref(false)
const codeRef = ref(null)

function digitsOnly(s) {
	return (s || '').replace(/\D/g, '')
}

// валидный телефон РФ в нашем формате = 11 цифр, начинается с 7
const isPhoneValid = computed(() => {
	const d = digitsOnly(phone.value)
	return d.length === 11 && d.startsWith('7')
})

watch(phone, val => {
	const masked = val
	const digits = digitsOnly(val)
	auth.setPhone({ masked, digits })
})

async function requestCode() {
	error.value = ''
	if (!isPhoneValid.value) return
	try {
		await api('/auth/request-code', {
			method: 'POST',
			body: { phone: auth.phoneDigits },
			auth: false,
		})
		auth.goToCode()
	} catch (e) {
		error.value = e.message
	}
}

function resendCode() {
	error.value = ''
	// позже тут будет запрос к бэку
}

function onCodeUpdate(v) {
	codeError.value = false
	error.value = ''
	code.value = v
	auth.setCode(v)
}

async function verifyCode(fullCode) {
	error.value = ''
	codeError.value = false

	try {
		const data = await api('/auth/verify-code', {
			method: 'POST',
			body: { phone: auth.phoneDigits, code: fullCode },
			auth: false,
		})

		auth.setSession({ token: data.token, user: data.user })
		window.location.href = '/chat'
	} catch (e) {
		error.value = e.message

		// 1) запускаем shake + красный бордер
		codeError.value = false
		await nextTick() // гарантируем, что смена флага не "склеится"
		codeError.value = true

		// 2) даём анимации начаться, потом очищаем
		setTimeout(() => {
			codeRef.value?.clearAndFocus?.()
		}, 300)

		// 3) выключаем флаг, чтобы анимация могла повторяться
		setTimeout(() => {
			codeError.value = false
		}, 260)
	}
}
</script>
