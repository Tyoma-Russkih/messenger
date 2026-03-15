import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../middlewares/auth.js'
import { upload } from '../upload.js'

const router = Router()

function normalizeUsername(value) {
	const v = String(value || '')
		.trim()
		.toLowerCase()
		.replace(/^@+/, '')

	return v
}

function isValidUsername(value) {
	return /^[a-z0-9_]{5,32}$/.test(value)
}

router.get('/me', requireAuth, async (req, res) => {
	const userId = req.user.sub

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			phone: true,
			name: true,
			bio: true,
			username: true,
			avatarUrl: true,
			lastSeenAt: true,
			createdAt: true,
		},
	})

	if (!user) {
		return res.status(404).json({ message: 'User not found' })
	}

	res.json({ ok: true, user })
})

router.patch('/me', requireAuth, async (req, res) => {
	const userId = req.user.sub

	const name = String(req.body?.name || '').trim()
	const bio = String(req.body?.bio || '').trim()
	const rawUsername = req.body?.username
	const username =
		rawUsername === undefined ? undefined : normalizeUsername(rawUsername)

	if (name.length > 80) {
		return res.status(400).json({ message: 'Имя слишком длинное' })
	}

	if (bio.length > 300) {
		return res.status(400).json({ message: 'Описание слишком длинное' })
	}

	if (username !== undefined && username !== '' && !isValidUsername(username)) {
		return res.status(400).json({
			message: 'Username должен быть 5–32 символа: a-z, 0-9 и _',
		})
	}

	if (username !== undefined && username !== '') {
		const existing = await prisma.user.findFirst({
			where: {
				username,
				NOT: { id: userId },
			},
			select: { id: true },
		})

		if (existing) {
			return res.status(409).json({ message: 'Username уже занят' })
		}
	}

	const user = await prisma.user.update({
		where: { id: userId },
		data: {
			name: name || null,
			bio: bio || null,
			username: username === undefined ? undefined : username || null,
		},
		select: {
			id: true,
			phone: true,
			name: true,
			bio: true,
			username: true,
			avatarUrl: true,
			lastSeenAt: true,
			createdAt: true,
		},
	})

	res.json({ ok: true, user })
})

// поиск пользователей по username
router.get('/search', requireAuth, async (req, res) => {
	const userId = req.user.sub
	const q = normalizeUsername(req.query.q)

	if (!q || q.length < 2) {
		return res.json({ ok: true, users: [] })
	}

	const users = await prisma.user.findMany({
		where: {
			id: { not: userId },
			username: {
				startsWith: q,
				mode: 'insensitive',
			},
		},
		orderBy: { username: 'asc' },
		take: 20,
		select: {
			id: true,
			phone: true,
			name: true,
			bio: true,
			username: true,
			avatarUrl: true,
			lastSeenAt: true,
		},
	})

	res.json({ ok: true, users })
})

router.post(
	'/me/avatar',
	requireAuth,
	upload.single('avatar'),
	async (req, res) => {
		const userId = req.user.sub

		if (!req.file) {
			return res.status(400).json({ message: 'Файл не выбран' })
		}

		if (!req.file.mimetype.startsWith('image/')) {
			return res.status(400).json({ message: 'Нужен файл изображения' })
		}

		const user = await prisma.user.update({
			where: { id: userId },
			data: {
				avatarUrl: `/uploads/${req.file.filename}`,
			},
			select: {
				id: true,
				phone: true,
				name: true,
				bio: true,
				username: true,
				avatarUrl: true,
				lastSeenAt: true,
				createdAt: true,
			},
		})

		res.json({ ok: true, user })
	},
)

export default router
