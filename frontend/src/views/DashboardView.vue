<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { session } from '../composables/useSession.js'
const router = useRouter()
const busy = ref(false)
const error = ref('')
async function retry() { await session.restore(); if (session.state.status === 'anonymous') await router.replace('/login') }
async function logout() {
  if (busy.value) return
  busy.value = true; error.value = ''
  try { await session.logout(); await router.replace('/login') }
  catch { error.value = 'No se pudo cerrar la sesión. Inténtalo de nuevo.' }
  finally { busy.value = false }
}
</script>
<template>
  <section class="shell-panel p-4 p-md-5 mx-auto">
    <h2>Tu panel</h2>
    <template v-if="session.state.actor && session.state.status === 'authenticated'">
      <p>Hola, {{ session.state.actor.firstName }}.</p>
      <RouterLink class="d-inline-block mb-3" to="/account">Mi cuenta</RouterLink>
      <p>Tu sesión está iniciada. El panel de grupos y eventos estará disponible en una próxima fase.</p>
      <p v-if="error" role="alert" class="text-danger">{{ error }}</p>
      <button class="btn btn-outline-primary" :disabled="busy" @click="logout">{{ busy ? 'Cerrando sesión…' : 'Cerrar sesión' }}</button>
    </template>
    <template v-else>
      <p role="alert">{{ session.state.error || 'No se pudo comprobar la sesión.' }}</p>
      <button class="btn btn-primary" @click="retry">Volver a comprobar la sesión</button>
    </template>
  </section>
</template>
