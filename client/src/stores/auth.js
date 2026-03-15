import { defineStore } from 'pinia'
import { api } from '../api/http'

export const useAuthStore = defineStore('auth', {
	state: () => ({
		step: 'phone',
		phoneDigits: '',
		phoneMasked: '',
		code: '',

		user: null,
		isReady: false,
	}),

	getters: {
		isAuthed: s => !!s.user,
		displayName: s =>
			s.user?.name ||
			(s.user?.username ? `@${s.user.username}` : s.user?.phone || ''),
	},

	actions: {
		setPhone({ masked, digits }) {
			this.phoneMasked = masked
			this.phoneDigits = digits
		},

		goToCode() {
			this.step = 'code'
			this.code = ''
		},

		goToPhone() {
			this.step = 'phone'
			this.code = ''
		},

		setCode(code) {
			this.code = code
		},

		async init() {
			const token = localStorage.getItem('token')
			if (!token) {
				this.isReady = true
				return
			}

			try {
				const data = await api('/profile/me')
				this.user = data.user
			} catch {
				localStorage.removeItem('token')
				this.user = null
			} finally {
				this.isReady = true
			}
		},

		async refreshProfile() {
			const data = await api('/profile/me')
			this.user = data.user
			return data.user
		},

		setSession({ token, user }) {
			localStorage.setItem('token', token)
			this.user = user
			this.isReady = true
		},

		logout() {
			localStorage.removeItem('token')
			this.user = null
			this.isReady = true
			this.step = 'phone'
			this.code = ''
			this.phoneDigits = ''
			this.phoneMasked = ''
		},
	},
})
