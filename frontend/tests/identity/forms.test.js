import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import PhoneInput from '../../src/components/PhoneInput.vue'
import { identity } from '../../src/api/identity.js'
import { session } from '../../src/composables/useSession.js'
import { routes, installSessionGuard } from '../../src/router/index.js'

vi.mock('../../src/api/identity.js', async (original) => ({ ...(await original()), identity: { me: vi.fn(), login: vi.fn(), logout: vi.fn(), recover: vi.fn(), reset: vi.fn() } }))
let wrapper
beforeEach(() => { vi.clearAllMocks(); session.clear(); session.notice(''); identity.me.mockRejectedValue({ status: 401 }); window.history.replaceState({}, '', '/') })
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
async function screen(path) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  installSessionGuard(router)
  await router.push(path); await router.isReady()
  wrapper = mount(RouterView, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return router
}

it('sanitizes paste and preserves caret, composition and model state', async () => {
  wrapper = mount(PhoneInput, { props: { modelValue: '' } })
  const input = wrapper.get('input')
  input.element.value = '+34 (600)-123 456'
  input.element.setSelectionRange(9, 9)
  await input.trigger('input')
  expect(input.element.value).toBe('+34600123456')
  expect(input.element.selectionStart).toBe(6)
  expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['+34600123456'])
  await input.trigger('compositionstart')
  input.element.value = '+34文'
  await input.trigger('input', { isComposing: true })
  expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
  await input.trigger('compositionend')
  expect(input.element.value).toBe('+34')
  expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['+34'])
})

it('renders login errors without losing exact password policy', async () => {
  await screen('/login')
  identity.login.mockRejectedValue({ status: 401 })
  await wrapper.get('#login-identifier').setValue('ana@example.test')
  await wrapper.get('#login-password').setValue(' exact password ')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(identity.login).toHaveBeenCalledWith('ana@example.test', ' exact password ')
  expect(wrapper.get('[role=alert]').text()).toContain('no son correctos')
  expect(wrapper.get('#login-password').element.value).toBe('')
  expect(wrapper.text()).not.toMatch(/Registrarse|Verificar cuenta/)
})

it('shows generic recovery acknowledgement and loading', async () => {
  await screen('/password-recovery')
  let resolve
  identity.recover.mockReturnValue(new Promise((yes) => { resolve = yes }))
  await wrapper.get('#recovery-identifier').setValue('ana@example.test')
  await wrapper.get('form').trigger('submit')
  expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  expect(wrapper.text()).toContain('Solicitando el enlace')
  resolve({ message: 'untrusted extra body' }); await flushPromises()
  expect(wrapper.text()).toContain('Si existe una cuenta')
  expect(wrapper.text()).not.toContain('untrusted extra body')
})

it('shows an actionable recovery service failure without claiming email delivery', async () => {
  await screen('/password-recovery')
  identity.recover.mockRejectedValue({ status: 503, message: 'No se pudo completar la solicitud.' })
  await wrapper.get('#recovery-identifier').setValue('ana@example.test')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(wrapper.get('[role=alert]').text()).toBe('No se pudo completar la solicitud.')
  expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  expect(wrapper.find('[role=status]').exists()).toBe(false)
  expect(wrapper.get('#recovery-identifier').element.value).toBe('ana@example.test')
})

it('clears fragment before requests and retains token after password field error', async () => {
  const token = 'a'.repeat(43)
  const router = await screen('/password-reset#token=' + token)
  expect(window.location.hash).toBe('')
  expect(router.currentRoute.value.hash).toBe('')
  expect(identity.reset).not.toHaveBeenCalled()
  identity.reset.mockRejectedValueOnce({ fields: { password: 'La contraseña no es válida.' }, message: 'Revisa la contraseña.' }).mockResolvedValueOnce(null)
  await wrapper.get('#reset-password').setValue(' exact password ')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(wrapper.get('#reset-password').attributes('aria-invalid')).toBe('true')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(identity.reset).toHaveBeenLastCalledWith(token, ' exact password ')
  expect(router.currentRoute.value.path).toBe('/login')
  expect(wrapper.text()).toContain('Contraseña actualizada')
})

it('shows missing and expired reset states without displaying token data', async () => {
  await screen('/password-reset')
  expect(wrapper.find('form').exists()).toBe(false)
  expect(wrapper.text()).toContain('no es válido o ha caducado')
})

it('guards anonymous dashboard navigation and network errors separately', async () => {
  const router = await screen('/dashboard')
  expect(router.currentRoute.value.path).toBe('/login')
  identity.me.mockRejectedValue({ status: 0 })
  await router.push('/dashboard'); await flushPromises()
  expect(router.currentRoute.value.path).toBe('/dashboard')
  expect(wrapper.text()).toContain('No se pudo comprobar la sesión')
  expect(wrapper.text()).not.toContain('Hola,')
})
