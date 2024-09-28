/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'

// Router
import router from './router'
import 'vue3-toastify/dist/index.css'

const app = createApp(App)

app.use(router)

registerPlugins(app)

app.mount('#app')
