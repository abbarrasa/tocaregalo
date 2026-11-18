<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { identity, passwordError } from '../api/identity.js'
import { session } from '../composables/useSession.js'
import { useForm } from '../composables/useForm.js'
const router = useRouter()
const route = useRoute()
const token = ref('')
const password = ref('')
const { busy, error, fields, begin, failed } = useForm()
let active = true
function takeFragment(hash) {
  if (!hash) return
  const candidate = new URLSearchParams(hash.slice(1)).get('token') ?? ''
  token.value = /^[A-Za-z0-9_-]{43}$/.test(candidate) ? candidate : ''
  password.value = ''
  const clean = window.location.pathname + window.location.search
  window.history.replaceState({ back: null, current: clean, forward: null, replaced: true, position: window.history.state?.position ?? 0, scroll: null }, '', clean)
  void router.replace({ path: '/password-reset', hash: '' })
}
takeFragment(route.hash)
watch(() => route.hash, takeFragment)
async function submit() {
  if (busy.value || !token.value) return
  const invalid = passwordError(password.value)
  if (invalid) return failed({ fields: { password: invalid } }, 'Revisa la contraseña.')
  begin()
  try {
    await identity.reset(token.value, password.value)
    token.value = ''; password.value = ''
    if (active) {
      session.clear(); session.notice('Contraseña actualizada. Ya puedes iniciar sesión.')
      await router.replace('/login')
    }
  } catch (problem) {
    if (active) {
      await failed(problem)
      if (problem.fields?.token) { token.value = ''; password.value = '' }
    }
  } finally { busy.value = false }
}
onBeforeUnmount(() => { active = false; token.value = ''; password.value = '' })
</script>
<template>
  <section class="shell-panel identity-panel p-4 p-md-5 mx-auto">
    <h2>Nueva contraseña</h2>
    <p v-if="error" role="alert" class="text-danger">{{ fields.token || error }}</p>
    <template v-if="token">
      <form novalidate :aria-busy="busy" @submit.prevent="submit">
        <label for="reset-password" class="form-label">Nueva contraseña</label>
        <input id="reset-password" v-model="password" class="form-control" type="password" autocomplete="new-password" required :disabled="busy"
          :aria-invalid="!!fields.password" aria-describedby="reset-help reset-password-error">
        <p id="reset-help" class="form-text">Al menos 6 caracteres y como máximo 4096 bytes UTF-8. Los espacios forman parte de la contraseña.</p>
        <p id="reset-password-error" class="text-danger">{{ fields.password }}</p>
        <button class="btn btn-primary w-100" :disabled="busy">{{ busy ? 'Guardando…' : 'Guardar contraseña' }}</button>
        <p v-if="busy" role="status" class="mt-2">Actualizando tu contraseña…</p>
      </form>
    </template>
    <p v-else role="status">El enlace de recuperación no es válido o ha caducado.</p>
    <RouterLink class="d-block mt-3" to="/password-recovery">Solicitar otro enlace</RouterLink>
    <RouterLink class="d-inline-block mt-3" to="/login">Volver a iniciar sesión</RouterLink>
  </section>
</template>
