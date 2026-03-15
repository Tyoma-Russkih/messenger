import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
	{ path: '/', redirect: '/login' },
	{
		path: '/login',
		name: 'login',
		component: () => import('../pages/LoginPage.vue'),
	},
	{
		path: '/chat/:chatId?',
		name: 'chat',
		component: () => import('../pages/ChatPage.vue'),
		meta: { auth: true },
	},
]

const router = createRouter({
	history: createWebHistory(),
	routes,
})

router.beforeEach(async to => {
	const auth = useAuthStore()

	if (!auth.isReady) {
		await auth.init()
	}

	if (to.meta.auth && !auth.isAuthed) {
		return { name: 'login' }
	}

	if (to.name === 'login' && auth.isAuthed) {
		return { name: 'chat' }
	}
})

export default router
