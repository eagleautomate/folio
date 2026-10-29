import './index.css'

import { createApp } from 'vue'
import { FrappeUI, setConfig, frappeRequest } from 'frappe-ui'
import router from './router'
import App from './App.vue'

setConfig('resourceFetcher', frappeRequest)

const app = createApp(App)
app.use(FrappeUI, { socketio: false })
app.use(router)
app.mount('#app')
