import './assets/sass/main.sass'

import { createApp } from 'vue'
import App from './App.vue'
import axios from 'axios'

/* import the fontawesome core */
import { library } from '@fortawesome/fontawesome-svg-core'
/* import font awesome icon component */
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
/* import specific icons */
import {
  faCircleExclamation,
  faCircle,
  faXmark,
  faCircleQuestion,
  faHashtag
} from '@fortawesome/free-solid-svg-icons'

import VueSelect from 'vue3-select-component'

const app = createApp(App)

/* add icons to the library */
library.add(faCircleExclamation, faCircle, faXmark, faCircleQuestion, faHashtag)

app.component('FontAwesomeIcon', FontAwesomeIcon)
app.component('VueSelect', VueSelect)

// 配置全局變數，頁面中使用 inject 接收
app.provide('global', {
  axios
})

app.mount('#app')
