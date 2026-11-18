import { afterEach, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import NotFoundView from '../../src/views/NotFoundView.vue'
import LoginView from '../../src/views/LoginView.vue'

let wrapper
afterEach(() => wrapper?.unmount())

it('shows the Spanish missing-route state and navigates to login', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: LoginView }, { path: '/password-recovery', component: LoginView }, { path: '/:pathMatch(.*)*', component: NotFoundView }],
  })
  await router.push('/unknown')
  await router.isReady()
  wrapper = mount(RouterView, { global: { plugins: [router] } })
  expect(wrapper.get('h2').text()).toBe('Página no encontrada')
  expect(wrapper.get('a').text()).toBe('Volver al inicio')
  await wrapper.get('a').trigger('click', { button: 0 })
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/')
  expect(wrapper.text()).toContain('Iniciar sesión')
})
