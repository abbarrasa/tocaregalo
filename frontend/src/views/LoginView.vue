<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import IdentifierInput from '../components/IdentifierInput.vue'
import { session } from '../composables/useSession.js'
import { useForm } from '../composables/useForm.js'
const router = useRouter()
const identifier = ref('')
const password = ref('')
const notice = ref(session.state.notice)
session.notice('')
const { busy, error, fields, begin, failed } = useForm()
let active = true
async function submit() {
  if (busy.value) return
  if (!identifier.value.trim()) return failed({ fields: { identifier: 'Introduce tu email o teléfono.' } }, 'Revisa los datos.')
  if (!password.value) return failed({ fields: { password: 'Introduce tu contraseña.' } }, 'Revisa los datos.')
  begin()
  try {
    await session.login(identifier.value, password.value)
    password.value = ''
    if (active) await router.replace('/dashboard')
  } catch (problem) {
    password.value = ''
    if (active) await failed(problem, problem.status === 401 ? 'El email, el teléfono o la contraseña no son correctos.' : problem.message)
  } finally { busy.value = false }
}
onBeforeUnmount(() => { active = false; password.value = '' })
</script>
<template>
  <section class="shell-panel identity-panel p-4 p-md-5 mx-auto">
    <h2>Iniciar sesión</h2>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="error" role="alert" class="text-danger">{{ error }}</p>
    <form novalidate :aria-busy="busy" @submit.prevent="submit">
      <IdentifierInput id="login-identifier" v-model="identifier" :error="fields.identifier" :disabled="busy" />
      <label for="login-password" class="form-label">Contraseña</label>
      <input id="login-password" v-model="password" class="form-control" type="password" autocomplete="current-password" required
        :disabled="busy" :aria-invalid="!!fields.password" aria-describedby="login-password-error">
      <p id="login-password-error" class="text-danger">{{ fields.password }}</p>
      <button class="btn btn-primary w-100" type="submit" :disabled="busy">{{ busy ? 'Entrando…' : 'Entrar' }}</button>
      <p v-if="busy" role="status" class="mt-2">Comprobando tus datos…</p>
    </form>
    <RouterLink class="d-inline-block mt-3" to="/password-recovery">¿Has olvidado tu contraseña?</RouterLink>
  </section>
</template>
