<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import PhoneInput from '../components/PhoneInput.vue'
import { passwordError } from '../api/identity.js'
import { session } from '../composables/useSession.js'
import { useForm } from '../composables/useForm.js'
const router = useRouter()
const keys = ['firstName', 'lastName', 'email', 'phone']
const labels = { firstName: 'Nombre', lastName: 'Apellidos (opcional)', email: 'Correo electrónico', phone: 'Número de teléfono' }
const draft = reactive({ firstName: '', lastName: '', email: '', phone: '' })
let baseline = {}
function populate(actor) {
  for (const key of keys) draft[key] = actor[key] ?? ''
  baseline = { ...draft }
}
if (session.state.actor) populate(session.state.actor)
const profile = reactive(useForm('#profile-form'))
const credentials = reactive(useForm('#password-form'))
const password = ref('')
const profileNotice = ref('')
const passwordNotice = ref('')
const busy = computed(() => profile.busy || credentials.busy)
const ready = computed(() => session.state.status === 'authenticated' && !!session.state.actor)
let active = true
function edited(key) { delete profile.fields[key]; profileNotice.value = '' }
function passwordEdited() { delete credentials.fields.password; passwordNotice.value = '' }
async function failure(form, problem) {
  if (!active) return
  if (problem.status === 401) { password.value = ''; await router.replace('/login'); return }
  form.busy = false
  await form.failed(problem, problem.status === 403 ? 'La solicitud no es válida. Inténtalo de nuevo.' : undefined)
}
async function saveProfile() {
  if (busy.value || !ready.value) return
  profileNotice.value = ''; profile.begin()
  try {
    const fields = {}
    for (const key of ['firstName', 'email', 'phone']) if (!draft[key].trim()) fields[key] = 'Este campo es obligatorio.'
    if (Object.keys(fields).length) { profile.busy = false; await profile.failed({ fields }, 'Revisa los datos.'); return }
    const values = {}
    for (const key of keys) if (draft[key] !== baseline[key]) values[key] = key === 'lastName' && !draft[key].trim() ? null : draft[key]
    if (!Object.keys(values).length) { profileNotice.value = 'No hay cambios para guardar'; return }
    const actor = await session.update(values)
    if (active && actor) { populate(actor); profileNotice.value = 'Datos actualizados' }
  } catch (problem) { await failure(profile, problem) }
  finally { profile.busy = false }
}
async function savePassword() {
  if (busy.value || !ready.value) return
  passwordNotice.value = ''; credentials.begin()
  const invalid = passwordError(password.value)
  if (invalid) { credentials.busy = false; await credentials.failed({ fields: { password: invalid } }, 'Revisa la contraseña.'); return }
  try {
    const actor = await session.update({ password: password.value })
    if (active && actor) passwordNotice.value = 'Contraseña actualizada'
  } catch (problem) { await failure(credentials, problem) }
  finally { password.value = ''; credentials.busy = false }
}
async function retry() {
  await session.restore()
  if (session.state.status === 'anonymous') await router.replace('/login')
  else if (active && session.state.actor) populate(session.state.actor)
}
onBeforeUnmount(() => { active = false; password.value = ''; for (const key of keys) draft[key] = ''; baseline = {} })
</script>
<template>
  <section class="shell-panel identity-panel p-4 p-md-5 mx-auto">
    <h2>Mi cuenta</h2>
    <template v-if="ready">
      <form id="profile-form" novalidate :aria-busy="profile.busy" @submit.prevent="saveProfile">
        <h3 class="h5">Datos personales</h3>
        <p v-if="profile.error" role="alert" class="text-danger">{{ profile.fields._form || profile.error }}</p>
        <p v-if="profileNotice" role="status">{{ profileNotice }}</p>
        <div v-for="key in keys" :key="key" class="mb-3">
          <label class="form-label" :for="`account-${key}`">{{ labels[key] }}</label>
          <PhoneInput v-if="key === 'phone'" :id="`account-${key}`" v-model="draft[key]" class="form-control" required maxlength="255"
            :disabled="busy" :aria-invalid="!!profile.fields[key]" :aria-describedby="`account-${key}-help account-${key}-error`" @update:model-value="edited(key)" />
          <input v-else :id="`account-${key}`" v-model="draft[key]" class="form-control" :type="key === 'email' ? 'email' : 'text'"
            :autocomplete="{ firstName: 'given-name', lastName: 'family-name', email: 'email' }[key]" maxlength="255" :required="key !== 'lastName'"
            :disabled="busy" :aria-invalid="!!profile.fields[key]" :aria-describedby="`account-${key}-error`" @input="edited(key)">
          <p v-if="key === 'phone'" :id="`account-${key}-help`" class="form-text">Incluye + y el prefijo de país, sin espacios ni signos adicionales.</p>
          <p :id="`account-${key}-error`" class="text-danger">{{ profile.fields[key] }}</p>
        </div>
        <button class="btn btn-primary w-100" :disabled="busy">{{ profile.busy ? 'Guardando…' : 'Guardar datos' }}</button>
        <p v-if="profile.busy" role="status">Guardando tus datos…</p>
      </form>
      <form id="password-form" class="mt-4" novalidate :aria-busy="credentials.busy" @submit.prevent="savePassword">
        <h3 class="h5">Cambiar contraseña</h3>
        <p v-if="credentials.error" role="alert" class="text-danger">{{ credentials.fields._form || credentials.error }}</p>
        <p v-if="passwordNotice" role="status">{{ passwordNotice }}</p>
        <label for="account-password" class="form-label">Nueva contraseña</label>
        <input id="account-password" v-model="password" type="password" autocomplete="new-password" class="form-control" required :disabled="busy"
          :aria-invalid="!!credentials.fields.password" aria-describedby="account-password-help account-password-error" @input="passwordEdited">
        <p id="account-password-help" class="form-text">Al menos 6 caracteres y como máximo 4096 bytes UTF-8. Los espacios forman parte de la contraseña.</p>
        <p id="account-password-error" class="text-danger">{{ credentials.fields.password }}</p>
        <button class="btn btn-primary w-100" :disabled="busy">{{ credentials.busy ? 'Guardando…' : 'Cambiar contraseña' }}</button>
        <p v-if="credentials.busy" role="status">Actualizando tu contraseña…</p>
      </form>
    </template>
    <template v-else>
      <p role="alert">{{ session.state.error || 'No se pudo comprobar la sesión.' }}</p>
      <button class="btn btn-primary" @click="retry">Volver a comprobar la sesión</button>
    </template>
    <RouterLink class="d-inline-block mt-4" to="/dashboard">Volver al panel</RouterLink>
  </section>
</template>
