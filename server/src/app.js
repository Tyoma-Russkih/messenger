import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

import path from 'path'
import { fileURLToPath } from 'url'

import authRouter from './routes/auth.js'
import chatsRouter from './routes/chats.js'
import profileRouter from './routes/profile.js'

const app = express()

app.use((req, res, next) => {
	res.removeHeader('Cross-Origin-Resource-Policy')
	res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
	next()
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(
	helmet({
		crossOriginResourcePolicy: false,
	}),
)
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.use(
	cors({
		origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
		credentials: true,
	}),
)

app.get('/health', (req, res) => res.json({ ok: true }))

app.use('/auth', authRouter)
app.use('/chats', chatsRouter)
app.use('/profile', profileRouter)


export default app
