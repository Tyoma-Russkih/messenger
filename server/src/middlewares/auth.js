import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
	try {
		const header = req.headers.authorization || ''
		const [type, token] = header.split(' ')

		if (type !== 'Bearer' || !token) {
			return res.status(401).json({ message: 'Unauthorized' })
		}

		const secret = process.env.JWT_SECRET
		if (!secret) throw new Error('JWT_SECRET is not set')

		const payload = jwt.verify(token, secret)
		req.user = payload // { sub, phone, iat, exp }
		next()
	} catch (e) {
		return res.status(401).json({ message: 'Unauthorized' })
	}
}
