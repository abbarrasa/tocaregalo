<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import IdentifierInput from '../components/IdentifierInput.vue'
import { identity } from '../api/identity.js'
import { useForm } from '../composables/useForm.js'
const identifier = ref('')
const sent = ref(false)
const { busy, error, fields, begin, failed } = useForm()
let active = true
async function submit() {
  if (busy.value) return
  if (!identifier.value.trim()) return failed({ fields: { identifier: 'Introduce tu email o teléfono.' } }, 'Revisa los datos.')
  begin()
  try { await identity.recover(identifier.value); if (active) sent.value = true }
  catch (problem) { if (active) await failed(problem) }
  finally { busy.value = false }
}
onBeforeUnmount(() => { active = false })
</script>
<template>
  <section class="shell-panel identity-panel p-4 p-md-5 mx-auto">
    <h2>Recuperar contraseña</h2>
    <p v-if="sent" role="status">Si existe una cuenta con esos datos, recibirás un enlace para restablecer la contraseña.</p>
    <template v-else>
      <p>Te enviaremos un enlace de un solo uso al correo de tu cuenta.</p>
      <p v-if="error" role="alert" class="text-danger">{{ error }}</p>
      <form novalidate :aria-busy="busy" @submit.prevent="submit">
        <IdentifierInput id="recovery-identifier" v-model="identifier" :error="fields.identifier" :disabled="busy" />
        <button class="btn btn-primary w-100" :disabled="busy">{{ busy ? 'Solicitando…' : 'Enviar enlace' }}</button>
        <p v-if="busy" role="status" class="mt-2">Solicitando el enlace…</p>
      </form>
    </template>
    <RouterLink class="d-inline-block mt-3" to="/login">Volver a iniciar sesión</RouterLink>
  </section>
</template>
