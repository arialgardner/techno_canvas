import { createApp } from 'vue'
import './style.css'
import './styles/dist.scss'
import App from './App.vue'
import router from './router/index'
import './firebase/config' // Initialize Firebase
import VueKonva from 'vue-konva'

const app = createApp(App)

app.use(router)
app.use(VueKonva)
app.mount('#app')