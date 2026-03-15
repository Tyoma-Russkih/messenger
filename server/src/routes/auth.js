import { Router } from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { prisma } from '../db.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

function digitsOnly(s) {
	return (s || '').replace(/\D/g, '')
}

// ожидаем "7XXXXXXXXXX" (11 цифр)
function normalizePhone(phone) {
	const d = digitsOnly(phone)
	if (d.length !== 11 || !d.startsWith('7')) return null
	return d
}

function generateCode() {
	// 6-значный код, включая ведущие нули
	return String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
}

function hashCode(code) {
	// простая хешировка для БД (не храним код в открытом виде)
	return crypto.createHash('sha256').update(code).digest('hex')
}

function signToken(user) {
	const secret = process.env.JWT_SECRET
	if (!secret) throw new Error('JWT_SECRET is not set')
	return jwt.sign({ sub: user.id, phone: user.phone }, secret, {
		expiresIn: '7d',
	})
}

// POST /auth/request-code { phone: "79991234567" или "+7 (999) ..." }
router.post('/request-code', async (req, res) => {
	const phone = normalizePhone(req.body?.phone)
	if (!phone) return res.status(400).json({ message: 'Invalid phone' })

	const code = generateCode()
	const codeHash = hashCode(code)

	const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 минут

	await prisma.authCode.create({
		data: {
			phone,
			codeHash,
			expiresAt,
		},
	})

	// DEV: печатаем код в консоль
	if (process.env.NODE_ENV !== 'production') {
		console.log(`[auth] code for ${phone}: ${code}`)
	}

	// В проде здесь будет интеграция с SMS-провайдером
	return res.json({ ok: true })
})

// POST /auth/verify-code { phone: "...", code: "123456" }
router.post('/verify-code', async (req, res) => {
	const phone = normalizePhone(req.body?.phone)
	const code = String(req.body?.code || '').trim()

	if (!phone) return res.status(400).json({ message: 'Invalid phone' })
	if (!/^\d{6}$/.test(code))
		return res.status(400).json({ message: 'Invalid code' })

	const codeHash = hashCode(code)

	// берём самый свежий неиспользованный код, не просроченный
	const record = await prisma.authCode.findFirst({
		where: {
			phone,
			codeHash,
			usedAt: null,
			expiresAt: { gt: new Date() },
		},
		orderBy: { createdAt: 'desc' },
	})

	if (!record) {
		return res.status(401).json({ message: 'Wrong or expired code' })
	}

	// помечаем использованным
	await prisma.authCode.update({
		where: { id: record.id },
		data: { usedAt: new Date() },
	})

	// создаём или находим пользователя
	const user = await prisma.user.upsert({
		where: { phone },
		update: {},
		create: { phone },
	})

	// привяжем запись к user (не обязательно, но красиво)
	await prisma.authCode.update({
		where: { id: record.id },
		data: { userId: user.id },
	})

	const token = signToken(user)

	return res.json({
		ok: true,
		token,
		user: { id: user.id, phone: user.phone },
	})
})

router.get('/me', requireAuth, async (req, res) => {
	const userId = req.user?.sub
	if (!userId) return res.status(401).json({ message: 'Unauthorized' })

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, phone: true, createdAt: true },
	})

	if (!user) return res.status(401).json({ message: 'Unauthorized' })
	return res.json({ ok: true, user })
})

export default router
