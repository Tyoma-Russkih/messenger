import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../middlewares/auth.js'
import { upload } from '../upload.js'

const router = Router()

function digitsOnly(s) {
	return (s || '').replace(/\D/g, '')
}

function normalizePhone(phone) {
	const d = digitsOnly(phone)
	if (d.length !== 11 || !d.startsWith('7')) return null
	return d
}

// GET /chats — список чатов текущего пользователя
router.get('/', requireAuth, async (req, res) => {
	const userId = req.user.sub

	const chats = await prisma.chat.findMany({
		where: {
			members: { some: { userId } },
		},
		orderBy: { updatedAt: 'desc' },
		include: {
			members: {
				include: {
					user: {
						select: {
							id: true,
							phone: true,
							name: true,
							username: true,
							avatarUrl: true,
							lastSeenAt: true,
						},
					},
				},
			},
			messages: {
				orderBy: { createdAt: 'desc' },
				take: 1,
				include: { sender: { select: { id: true, phone: true } } },
			},
		},
	})

	const result = []
	for (const c of chats) {
		const last = c.messages[0] || null

		let title = c.title || ''
		let other = null // 👈 ВАЖНО — объявляем переменную

		if (c.type === 'DIRECT') {
			other = c.members.find(m => m.userId !== userId)?.user

			title =
				title ||
				other?.name ||
				(other?.username ? `@${other.username}` : null) ||
				other?.phone ||
				'Диалог'
		} else {
			title = title || 'Группа'
		}

		const unreadCount = await prisma.messageReceipt.count({
			where: {
				userId,
				readAt: null,
				message: { chatId: c.id },
			},
		})

		result.push({
			id: c.id,
			type: c.type,
			title,
			lastMessageText: last
				? last.type === 'IMAGE'
					? 'Изображение'
					: last.type === 'FILE'
						? last.fileName || 'Файл'
						: last.text || ''
				: '',
			lastMessageAt: last?.createdAt || c.updatedAt,
			unreadCount,
			otherUser: other
				? {
						id: other.id,
						phone: other.phone,
						name: other.name,
						username: other.username,
						avatarUrl: other.avatarUrl,
						lastSeenAt: other.lastSeenAt,
					}
				: null,
		})
	}

	res.json({ ok: true, chats: result })
})

// POST /chats/direct { phone } — создать/найти DIRECT чат с пользователем по телефону
router.post('/direct', requireAuth, async (req, res) => {
	const userId = req.user.sub
	const otherPhone = normalizePhone(req.body?.phone)
	if (!otherPhone) return res.status(400).json({ message: 'Invalid phone' })

	const otherUser = await prisma.user.upsert({
		where: { phone: otherPhone },
		update: {},
		create: { phone: otherPhone },
	})

	if (otherUser.id === userId) {
		return res.status(400).json({ message: 'Cannot chat with yourself' })
	}

	// Ищем существующий DIRECT чат ровно с этими двумя участниками
	const existing = await prisma.chat.findFirst({
		where: {
			type: 'DIRECT',
			AND: [
				{ members: { some: { userId } } },
				{ members: { some: { userId: otherUser.id } } },
			],
		},
		select: { id: true },
	})

	if (existing) return res.json({ ok: true, chatId: existing.id })

	const chat = await prisma.chat.create({
		data: {
			type: 'DIRECT',
			members: {
				create: [{ userId }, { userId: otherUser.id }],
			},
		},
		select: { id: true },
	})

	res.json({ ok: true, chatId: chat.id })
})

// GET /chats/:chatId/messages?cursor=...&take=50 — история сообщений (пагинация по id)
router.get('/:chatId/messages', requireAuth, async (req, res) => {
	const userId = req.user.sub
	const { chatId } = req.params

	const take = Math.min(parseInt(req.query.take || '50', 10), 100)
	const cursor = req.query.cursor ? String(req.query.cursor) : null

	// проверка участия в чате
	const member = await prisma.chatMember.findUnique({
		where: { chatId_userId: { chatId, userId } },
		select: { id: true },
	})
	if (!member) return res.status(403).json({ message: 'Forbidden' })

	// берём "страницу" в DESC (новые -> старые), затем разворачиваем
	const itemsDesc = await prisma.message.findMany({
		where: { chatId },
		orderBy: { createdAt: 'desc' },
		take: take + 1, // +1 чтобы понять, есть ли ещё
		...(cursor
			? {
					cursor: { id: cursor },
					skip: 1, // не включать сам cursor
				}
			: {}),
		include: {
			sender: { select: { id: true, phone: true } },
			replyTo: {
				select: {
					id: true,
					text: true,
					sender: { select: { id: true, phone: true } },
				},
			},
			receipts: { select: { userId: true, deliveredAt: true, readAt: true } },
		},
	})

	const hasMore = itemsDesc.length > take
	const pageDesc = hasMore ? itemsDesc.slice(0, take) : itemsDesc

	// отдаём старые -> новые
	const messages = pageDesc.reverse()

	res.json({
		ok: true,
		messages,
		hasMore,
	})
})

// POST /chats/:chatId/messages { text } — отправить сообщение
router.post('/:chatId/messages', requireAuth, async (req, res) => {
	const userId = req.user.sub
	const { chatId } = req.params
	const text = String(req.body?.text || '').trim()

	if (!text) return res.status(400).json({ message: 'Empty message' })
	if (text.length > 2000)
		return res.status(400).json({ message: 'Message too long' })

	const member = await prisma.chatMember.findUnique({
		where: { chatId_userId: { chatId, userId } },
		select: { id: true },
	})

	if (!member) return res.status(403).json({ message: 'Forbidden' })

	const replyToId = String(req.body?.replyToId || '').trim() || null

	let replyPreviewText = null
	let replyPreviewSenderPhone = null

	if (replyToId) {
		const replyMsg = await prisma.message.findUnique({
			where: { id: replyToId },
			include: {
				sender: {
					select: { phone: true },
				},
			},
		})

		if (replyMsg) {
			replyPreviewText = replyMsg.text
			replyPreviewSenderPhone = replyMsg.sender.phone
		}
	}

	const msg = await prisma.message.create({
		data: {
			chatId,
			senderId: userId,
			text,
			replyToId,
			replyPreviewText,
			replyPreviewSenderPhone,
		},
		include: {
			sender: { select: { id: true, phone: true } },
			replyTo: {
				select: {
					id: true,
					text: true,
					sender: { select: { id: true, phone: true } },
				},
			},
			receipts: { select: { userId: true, deliveredAt: true, readAt: true } },
		},
	})

	const members = await prisma.chatMember.findMany({
		where: { chatId },
		select: { userId: true },
	})

	// receipts только для получателей (не для отправителя)
	const recipientIds = members.map(m => m.userId).filter(id => id !== userId)

	if (recipientIds.length) {
		await prisma.messageReceipt.createMany({
			data: recipientIds.map(rid => ({
				messageId: msg.id,
				userId: rid,
			})),
			skipDuplicates: true,
		})
	}

	// чтобы список чатов сортировался по активности
	await prisma.chat.update({
		where: { id: chatId },
		data: { updatedAt: new Date() },
	})

	const io = req.app.get('io')
	if (io) {
		for (const rid of recipientIds) {
			// доставляем событие
			io.to(`user:${rid}`).emit('message:new', { chatId, message: msg })

			// если у юзера реально есть подключение — отмечаем delivered
			const room = io.sockets.adapter.rooms.get(`user:${rid}`)
			if (room && room.size > 0) {
				await prisma.messageReceipt.update({
					where: { messageId_userId: { messageId: msg.id, userId: rid } },
					data: { deliveredAt: new Date() },
				})

				// и отправителю (и получателю) сообщаем о delivered
				io.to(`user:${userId}`).emit('message:delivered', {
					chatId,
					messageId: msg.id,
					userId: rid,
					deliveredAt: new Date().toISOString(),
				})
				io.to(`user:${rid}`).emit('message:delivered', {
					chatId,
					messageId: msg.id,
					userId: rid,
					deliveredAt: new Date().toISOString(),
				})
			}
		}

		// обновим список чатов для всех участников
		for (const m of members) {
			const unreadCount = await prisma.messageReceipt.count({
				where: { userId: m.userId, readAt: null, message: { chatId } },
			})

			io.to(`user:${m.userId}`).emit('chat:updated', {
				chatId,
				lastMessageText: msg.text,
				lastMessageAt: msg.createdAt,
				unreadCount,
			})
		}
	}

	res.json({ ok: true, message: msg })
})

router.patch('/messages/:messageId', requireAuth, async (req, res) => {
	const userId = req.user.sub
	const { messageId } = req.params
	const text = String(req.body?.text || '').trim()

	if (!text) return res.status(400).json({ message: 'Empty message' })
	if (text.length > 2000)
		return res.status(400).json({ message: 'Message too long' })

	const existing = await prisma.message.findUnique({
		where: { id: messageId },
		select: {
			id: true,
			chatId: true,
			senderId: true,
		},
	})

	if (!existing) {
		return res.status(404).json({ message: 'Message not found' })
	}

	if (existing.senderId !== userId) {
		return res.status(403).json({ message: 'Forbidden' })
	}

	const message = await prisma.message.update({
		where: { id: messageId },
		data: {
			text,
			editedAt: new Date(),
		},
		include: {
			sender: { select: { id: true, phone: true } },
			replyTo: {
				select: {
					id: true,
					text: true,
					sender: { select: { id: true, phone: true } },
				},
			},
			receipts: { select: { userId: true, deliveredAt: true, readAt: true } },
		},
	})

	const io = req.app.get('io')
	if (io) {
		const members = await prisma.chatMember.findMany({
			where: { chatId: existing.chatId },
			select: { userId: true },
		})

		for (const m of members) {
			io.to(`user:${m.userId}`).emit('message:updated', {
				chatId: existing.chatId,
				message,
			})
		}

		// если редактировали последнее сообщение, обновим превью чата
		const lastMessage = await prisma.message.findFirst({
			where: { chatId: existing.chatId },
			orderBy: { createdAt: 'desc' },
			select: { id: true, text: true, createdAt: true },
		})

		if (lastMessage && lastMessage.id === messageId) {
			for (const m of members) {
				const unreadCount = await prisma.messageReceipt.count({
					where: {
						userId: m.userId,
						readAt: null,
						message: { chatId: existing.chatId },
					},
				})

				io.to(`user:${m.userId}`).emit('chat:updated', {
					chatId: existing.chatId,
					lastMessageText: message.text,
					lastMessageAt: lastMessage.createdAt,
					unreadCount,
				})
			}
		}
	}

	res.json({ ok: true, message })
})

router.post('/:chatId/read', requireAuth, async (req, res) => {
	const userId = req.user.sub
	const { chatId } = req.params
	const lastMessageId = String(req.body?.lastMessageId || '').trim()
	if (!lastMessageId)
		return res.status(400).json({ message: 'lastMessageId required' })

	const member = await prisma.chatMember.findUnique({
		where: { chatId_userId: { chatId, userId } },
		select: { id: true },
	})
	if (!member) return res.status(403).json({ message: 'Forbidden' })

	const lastMsg = await prisma.message.findUnique({
		where: { id: lastMessageId },
		select: { id: true, chatId: true, createdAt: true },
	})
	if (!lastMsg || lastMsg.chatId !== chatId) {
		return res.status(400).json({ message: 'Invalid lastMessageId' })
	}

	// помечаем read все receipts этого юзера в этом чате до createdAt включительно
	await prisma.messageReceipt.updateMany({
		where: {
			userId,
			readAt: null,
			message: { chatId, createdAt: { lte: lastMsg.createdAt } },
		},
		data: { readAt: new Date() },
	})

	const io = req.app.get('io')
	if (io) {
		// обновим unread в списке чатов
		const unreadCount = await prisma.messageReceipt.count({
			where: { userId, readAt: null, message: { chatId } },
		})
		io.to(`user:${userId}`).emit('chat:updated', { chatId, unreadCount })

		// уведомим остальных участников о read (для галочек)
		const members = await prisma.chatMember.findMany({
			where: { chatId },
			select: { userId: true },
		})
		for (const m of members) {
			if (m.userId !== userId) {
				io.to(`user:${m.userId}`).emit('message:read', {
					chatId,
					userId,
					lastMessageId,
					readAt: new Date().toISOString(),
				})
			}
		}
	}

	res.json({ ok: true })
})

router.delete('/messages/:messageId', requireAuth, async (req, res) => {
	const userId = req.user.sub
	const { messageId } = req.params

	const existing = await prisma.message.findUnique({
		where: { id: messageId },
		select: {
			id: true,
			chatId: true,
			senderId: true,
			createdAt: true,
		},
	})

	if (!existing) {
		return res.status(404).json({ message: 'Message not found' })
	}

	if (existing.senderId !== userId) {
		return res.status(403).json({ message: 'Forbidden' })
	}

	await prisma.message.delete({
		where: { id: messageId },
	})

	const io = req.app.get('io')

	const members = await prisma.chatMember.findMany({
		where: { chatId: existing.chatId },
		select: { userId: true },
	})

	const lastMessage = await prisma.message.findFirst({
		where: { chatId: existing.chatId },
		orderBy: { createdAt: 'desc' },
		select: { id: true, text: true, createdAt: true },
	})

	if (io) {
		for (const m of members) {
			io.to(`user:${m.userId}`).emit('message:deleted', {
				chatId: existing.chatId,
				messageId,
			})
		}

		for (const m of members) {
			const unreadCount = await prisma.messageReceipt.count({
				where: {
					userId: m.userId,
					readAt: null,
					message: { chatId: existing.chatId },
				},
			})

			io.to(`user:${m.userId}`).emit('chat:updated', {
				chatId: existing.chatId,
				lastMessageText: lastMessage?.text || '',
				lastMessageAt: lastMessage?.createdAt || null,
				unreadCount,
			})
		}
	}

	res.json({ ok: true, messageId })
})

router.post(
	'/:chatId/files',
	requireAuth,
	upload.single('file'),
	async (req, res) => {
		const userId = req.user.sub
		const { chatId } = req.params
		const replyToId = String(req.body?.replyToId || '').trim() || null

		const member = await prisma.chatMember.findUnique({
			where: { chatId_userId: { chatId, userId } },
			select: { id: true },
		})

		if (!member) return res.status(403).json({ message: 'Forbidden' })
		if (!req.file) return res.status(400).json({ message: 'File is required' })

		let replyPreviewText = null
		let replyPreviewSenderPhone = null

		if (replyToId) {
			const replyMsg = await prisma.message.findUnique({
				where: { id: replyToId },
				include: {
					sender: { select: { phone: true } },
				},
			})

			if (replyMsg) {
				replyPreviewText = replyMsg.text || replyMsg.fileName || 'Файл'
				replyPreviewSenderPhone = replyMsg.sender.phone
			}
		}

		const isImage = req.file.mimetype.startsWith('image/')

		const msg = await prisma.message.create({
			data: {
				chatId,
				senderId: userId,
				text: '',
				type: isImage ? 'IMAGE' : 'FILE',
				fileUrl: `/uploads/${req.file.filename}`,
				fileName: req.file.originalname,
				mimeType: req.file.mimetype,
				fileSize: req.file.size,
				replyToId,
				replyPreviewText,
				replyPreviewSenderPhone,
			},
			include: {
				sender: { select: { id: true, phone: true } },
				replyTo: {
					select: {
						id: true,
						text: true,
						sender: { select: { id: true, phone: true } },
					},
				},
				receipts: { select: { userId: true, deliveredAt: true, readAt: true } },
			},
		})

		const members = await prisma.chatMember.findMany({
			where: { chatId },
			select: { userId: true },
		})

		const recipientIds = members.map(m => m.userId).filter(id => id !== userId)

		if (recipientIds.length) {
			await prisma.messageReceipt.createMany({
				data: recipientIds.map(rid => ({
					messageId: msg.id,
					userId: rid,
				})),
				skipDuplicates: true,
			})
		}

		await prisma.chat.update({
			where: { id: chatId },
			data: { updatedAt: new Date() },
		})

		const io = req.app.get('io')
		if (io) {
			for (const rid of recipientIds) {
				io.to(`user:${rid}`).emit('message:new', { chatId, message: msg })

				const room = io.sockets.adapter.rooms.get(`user:${rid}`)
				if (room && room.size > 0) {
					const deliveredAt = new Date()

					await prisma.messageReceipt.update({
						where: { messageId_userId: { messageId: msg.id, userId: rid } },
						data: { deliveredAt },
					})

					io.to(`user:${userId}`).emit('message:delivered', {
						chatId,
						messageId: msg.id,
						userId: rid,
						deliveredAt: deliveredAt.toISOString(),
					})

					io.to(`user:${rid}`).emit('message:delivered', {
						chatId,
						messageId: msg.id,
						userId: rid,
						deliveredAt: deliveredAt.toISOString(),
					})
				}
			}

			for (const m of members) {
				const unreadCount = await prisma.messageReceipt.count({
					where: {
						userId: m.userId,
						readAt: null,
						message: { chatId },
					},
				})

				io.to(`user:${m.userId}`).emit('chat:updated', {
					chatId,
					lastMessageText: isImage
						? 'Изображение'
						: req.file.originalname || 'Файл',
					lastMessageAt: msg.createdAt,
					unreadCount,
				})
			}
		}

		res.json({ ok: true, message: msg })
	},
)

router.post('/direct/by-username', requireAuth, async (req, res) => {
	const userId = req.user.sub
	const username = String(req.body?.username || '')
		.trim()
		.toLowerCase()
		.replace(/^@+/, '')

	if (!username) {
		return res.status(400).json({ message: 'Username is required' })
	}

	const otherUser = await prisma.user.findUnique({
		where: { username },
		select: { id: true },
	})

	if (!otherUser) {
		return res.status(404).json({ message: 'Пользователь не найден' })
	}

	if (otherUser.id === userId) {
		return res.status(400).json({ message: 'Нельзя создать чат с собой' })
	}

	const existing = await prisma.chat.findFirst({
		where: {
			type: 'DIRECT',
			AND: [
				{ members: { some: { userId } } },
				{ members: { some: { userId: otherUser.id } } },
			],
		},
		select: { id: true },
	})

	if (existing) {
		return res.json({ ok: true, chatId: existing.id })
	}

	const chat = await prisma.chat.create({
		data: {
			type: 'DIRECT',
			members: {
				create: [{ userId }, { userId: otherUser.id }],
			},
		},
		select: { id: true },
	})

	res.json({ ok: true, chatId: chat.id })
})

export default router
