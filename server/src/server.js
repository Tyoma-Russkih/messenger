import 'dotenv/config'
import http from 'http'
import app from './app.js'
import { createIO } from './socket.js'

const port = process.env.PORT || 3001

const httpServer = http.createServer(app)
const io = createIO(httpServer)

// сделаем io доступным в роутерах через req.app.get('io')
app.set('io', io)

httpServer.listen(port, () => {
	console.log(`[server] http://localhost:${port}`)
})
