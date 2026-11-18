<script setup>
import { RouterView } from 'vue-router'
import { session } from './composables/useSession.js'
</script>
<template>
  <main class="container py-4 py-md-5">
    <h1 class="text-center mb-4">Toca Regalo</h1>
    <p v-if="session.state.status === 'loading'" role="status" class="text-center">Comprobando la sesión…</p>
    <RouterView v-else />
  </main>
</template>
