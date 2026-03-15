import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { vMaska } from 'maska/vue'
import router from './router'
import './style.css'
import App from './App.vue'

import { initRealtime } from './realtime/initRealtime'
import { setupNotificationPermissionOnFirstUserAction } from './utils/notifications'

const app = createApp(App)
const pinia = createPinia()

app.directive('maska', vMaska)
app.use(pinia)
app.use(router)
app.mount('#app')

// 1. Подключаем realtime после инициализации приложения
initRealtime()

// 2. Один раз мягко просим permission на первом действии пользователя
setupNotificationPermissionOnFirstUserAction()
