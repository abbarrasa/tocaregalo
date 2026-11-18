import { createApp } from 'vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import './assets/main.css'
import App from './App.vue'
import router from './router/index.js'
import phonePlugin from './plugins/phone.js'

createApp(App).use(router).use(phonePlugin).mount('#app')
