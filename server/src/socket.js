import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { prisma } from './db.js'

const onlineUsers = new Set() // userId которые сейчас онлайн

export function createIO(httpServer) {
	const io = new Server(httpServer, {
		cors: {
			origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
			credentials: true,
		},
	})

	io.use((socket, next) => {
		try {
			const token = socket.handshake.auth?.token
			if (!token) return next(new Error('Unauthorized'))

			const secret = process.env.JWT_SECRET
			const payload = jwt.verify(token, secret)

			socket.user = payload
			next()
		} catch {
			next(new Error('Unauthorized'))
		}
	})

	io.on('connection', async socket => {
		const userId = socket.user?.sub
		// user room
		socket.join(`user:${userId}`)

		// отмечаем онлайн
		onlineUsers.add(userId)

		// ✅ отправляем подключившемуся сокету список, кто сейчас онлайн
		socket.emit('presence:sync', { onlineUserIds: Array.from(onlineUsers) })

		// ✅ всем остальным сообщаем, что этот юзер онлайн
		socket.broadcast.emit('user:online', { userId })

		await prisma.user.update({
			where: { id: userId },
			data: { lastSeenAt: null },
		})

		console.log('[io] connected', userId)
		console.log(`[io] user room joined user:${userId}`)

		// 🔥 ВОТ ЗДЕСЬ ЖИВЁТ join
		socket.on('chat:join', async ({ chatId }) => {
			if (!chatId) return

			// проверяем, что юзер реально участник
			const member = await prisma.chatMember.findUnique({
				where: { chatId_userId: { chatId, userId } },
				select: { id: true },
			})
			if (!member) return

			socket.join(`chat:${chatId}`)
			console.log(`[io] user ${userId} joined chat ${chatId}`)
		})

		socket.on('chat:leave', ({ chatId }) => {
			if (!chatId) return
			socket.leave(`chat:${chatId}`)
			console.log(`[io] user ${userId} left chat ${chatId}`)
		})

		socket.on('typing:start', async ({ chatId }) => {
			const userId = socket.user?.sub
			if (!chatId || !userId) return

			// проверка участника чата
			const member = await prisma.chatMember.findUnique({
				where: { chatId_userId: { chatId, userId } },
				select: { id: true },
			})
			if (!member) return

			// всем участникам (кроме себя)
			const members = await prisma.chatMember.findMany({
				where: { chatId },
				select: { userId: true },
			})
			for (const m of members) {
				if (m.userId !== userId) {
					io.to(`user:${m.userId}`).emit('typing', {
						chatId,
						userId,
						isTyping: true,
					})
				}
			}
		})

		socket.on('typing:stop', async ({ chatId }) => {
			const userId = socket.user?.sub
			if (!chatId || !userId) return

			const member = await prisma.chatMember.findUnique({
				where: { chatId_userId: { chatId, userId } },
				select: { id: true },
			})
			if (!member) return

			const members = await prisma.chatMember.findMany({
				where: { chatId },
				select: { userId: true },
			})
			for (const m of members) {
				if (m.userId !== userId) {
					io.to(`user:${m.userId}`).emit('typing', {
						chatId,
						userId,
						isTyping: false,
					})
				}
			}
		})

		socket.on('disconnect', async () => {
			// если у пользователя ещё есть активные сокеты (другая вкладка) — он всё ещё онлайн
			const room = io.sockets.adapter.rooms.get(`user:${userId}`)
			const stillOnline = room && room.size > 0
			if (stillOnline) return

			onlineUsers.delete(userId)

			const ts = new Date()

			await prisma.user.update({
				where: { id: userId },
				data: { lastSeenAt: ts },
			})

			socket.broadcast.emit('user:offline', {
				userId,
				lastSeenAt: ts.toISOString(),
			})
		})
	})

	return io
}
