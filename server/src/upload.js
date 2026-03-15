import fs from 'fs'
import path from 'path'
import multer from 'multer'

const uploadsDir = path.join(process.cwd(), 'uploads')

if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true })
}

function decodeOriginalName(name) {
	try {
		return Buffer.from(name, 'latin1').toString('utf8')
	} catch {
		return name
	}
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadsDir)
	},
	filename: (req, file, cb) => {
		const decodedName = decodeOriginalName(file.originalname)

		// сохраняем нормальное имя обратно в объект файла,
		// чтобы потом использовать его в req.file.originalname
		file.originalname = decodedName

		const ext = path.extname(decodedName)

		// на диске храним простое безопасное имя,
		// чтобы не было проблем с URL и спецсимволами
		cb(null, `${Date.now()}${ext}`)
	},
})

export const upload = multer({
	storage,
	limits: {
		fileSize: 20 * 1024 * 1024,
	},
})
