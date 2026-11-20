<script setup lang="ts">
defineProps<{ nextCursor: string | null; cursor: string | null; loading: boolean }>();
defineEmits<{ next: []; restart: [] }>();
</script>
<template>
  <nav class="d-flex gap-3 flex-wrap mt-4" aria-label="Paginación">
    <button v-if="cursor !== null" class="btn btn-outline-primary" :disabled="loading" @click="$emit('restart')">Volver al principio</button>
    <button v-if="nextCursor !== null" class="btn btn-outline-primary" :disabled="loading" @click="$emit('next')">Siguiente página</button>
  </nav>
</template>
