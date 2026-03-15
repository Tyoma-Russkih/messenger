import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { vMaska } from 'maska/vue'
import router from './router'
import './style.css'
import App from './App.vue'

const app = createApp(App)

app.directive('maska', vMaska)
app.use(createPinia())
app.use(router)

app.mount('#app')
