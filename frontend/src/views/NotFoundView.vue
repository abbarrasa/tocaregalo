<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="mx-auto shell-panel p-4 p-md-5">
    <h2>Página no encontrada</h2>
    <p>La página que buscas no existe.</p>
    <RouterLink class="btn btn-primary" to="/">Volver al inicio</RouterLink>
  </section>
</template>
