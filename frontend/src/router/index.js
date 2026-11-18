import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { session } from '../composables/useSession.js'
import LoginView from '../views/LoginView.vue'
import RecoveryView from '../views/RecoveryView.vue'
import ResetPasswordView from '../views/ResetPasswordView.vue'
import DashboardView from '../views/DashboardView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import AccountView from '../views/AccountView.vue'

export function installSessionGuard(router, currentSession = session) {
  router.beforeEach(async (to) => {
    if (to.meta.requiresSession || (to.name === 'login' && currentSession.state.status === 'unknown')) await currentSession.restore()
    if (to.meta.requiresSession && currentSession.state.status === 'anonymous') return { name: 'login', replace: true }
    if (to.name === 'login' && currentSession.state.status === 'authenticated') return { name: 'dashboard', replace: true }
    return true
  })
}
export const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/password-recovery', name: 'recovery', component: RecoveryView },
  { path: '/password-reset', name: 'reset', component: ResetPasswordView },
  { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { requiresSession: true } },
  { path: '/account', name: 'account', component: AccountView, meta: { requiresSession: true } },
  { path: '/:pathMatch(.*)*', component: NotFoundView },
]
const router = createRouter({ history: createWebHistory(), routes })
installSessionGuard(router)
router.afterEach(async () => {
  await nextTick()
  const heading = document.querySelector('main h2') ?? document.querySelector('main h1')
  heading?.setAttribute('tabindex', '-1')
  heading?.focus()
})
export default router
