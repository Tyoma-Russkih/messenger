const NOTIFICATION_CLICK_KEY = 'notifications-prompted-once'

export function isNotificationsSupported() {
	return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission() {
	if (!isNotificationsSupported()) return 'unsupported'
	return Notification.permission
}

/**
 * Вызываем ТОЛЬКО из обработчика пользовательского действия:
 * click / submit / нажатие на кнопку.
 */
export async function requestNotificationPermission() {
	if (!isNotificationsSupported()) return false

	if (Notification.permission === 'granted') return true
	if (Notification.permission === 'denied') return false

	const permission = await Notification.requestPermission()
	return permission === 'granted'
}

/**
 * Один раз в жизни вкладки/приложения подвешиваем "мягкий" запрос:
 * когда пользователь впервые кликнет по приложению, появится системный prompt.
 *
 * Это компромиссный вариант, чтобы не искать сейчас конкретную страницу логина.
 * Потом лучше перенести вызов requestNotificationPermission() в кнопку
 * "Включить уведомления" или в успешный submit логина.
 */
export function setupNotificationPermissionOnFirstUserAction() {
	if (!isNotificationsSupported()) return
	if (Notification.permission !== 'default') return

	if (localStorage.getItem(NOTIFICATION_CLICK_KEY) === '1') return

	const handler = async () => {
		localStorage.setItem(NOTIFICATION_CLICK_KEY, '1')

		try {
			await requestNotificationPermission()
		} catch (e) {
			console.error('[notifications] request permission failed', e)
		} finally {
			window.removeEventListener('click', handler)
			window.removeEventListener('keydown', handler)
		}
	}

	window.addEventListener('click', handler, { once: true })
	window.addEventListener('keydown', handler, { once: true })
}

export function buildMessageNotificationBody(message) {
	if (!message) return 'Новое сообщение'

	if (message.type === 'IMAGE') return 'Отправил(а) изображение'
	if (message.type === 'FILE') return message.fileName || 'Отправил(а) файл'

	const text = String(message.text || '').trim()
	return text || 'Новое сообщение'
}

export function showSystemNotification({
	title,
	body,
	tag,
	icon = '/vite.svg',
	data = {},
}) {
	if (!isNotificationsSupported()) return null
	if (Notification.permission !== 'granted') return null

	const notification = new Notification(title, {
		body,
		tag,
		icon,
		badge: icon,
		data,
	})

	notification.onclick = () => {
		window.focus()
	}

	return notification
}
