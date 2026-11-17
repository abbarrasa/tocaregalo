import { createRouter, createWebHistory } from 'vue-router'
import PreparationView from '../views/PreparationView.vue'
import NotFoundView from '../views/NotFoundView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: PreparationView },
    { path: '/:pathMatch(.*)*', component: NotFoundView },
  ],
})
