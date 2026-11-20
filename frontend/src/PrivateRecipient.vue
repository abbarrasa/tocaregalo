<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { ApiError } from './api.ts';
import type { OwnRecipient, RecipientClient } from './recipient-client.ts';
const props = defineProps<{ eventId: string; client: RecipientClient }>();
const emit = defineEmits<{ expired: [] }>();
const result = ref<OwnRecipient | null>(null); const loading = ref(false); const error = ref('');
const messageElement = ref<HTMLElement>(); const revealButton = ref<HTMLButtonElement>(); let generation = 0;
function clear() { generation++; result.value = null; loading.value = false; error.value = ''; }
defineExpose({ clear });
async function hide() { clear(); await nextTick(); revealButton.value?.focus(); }
async function reveal() {
  if (loading.value) return;
  clear(); const request = generation; loading.value = true;
  try {
    const found = await props.client.find(props.eventId);
    if (request === generation) result.value = found;
  } catch (failure) {
    if (request !== generation) return;
    if (failure instanceof ApiError && failure.status === 401) { emit('expired'); return; }
    error.value = failure instanceof ApiError && failure.status === 409
      ? 'La asignación está pendiente o el sorteo ha quedado desactualizado. Puedes consultar de nuevo más adelante.'
      : failure instanceof ApiError && failure.status === 404
        ? 'La asignación no está disponible para tu cuenta en este evento.'
        : 'No se pudo consultar tu destinatario. Inténtalo más tarde.';
  } finally {
    if (request === generation) { loading.value = false; await nextTick(); messageElement.value?.focus(); }
  }
}
onBeforeUnmount(clear);
</script>
<template>
  <section class="card mt-4" aria-labelledby="recipient-title" :aria-busy="loading"><div class="card-body">
    <h2 id="recipient-title">Mi destinatario</h2>
    <p class="text-muted mt-3">Solo puedes consultar tu propia asignación, también si eres propietario. Mientras el evento esté abierto, puede cambiar al recalcular el sorteo.</p>
    <button v-if="!result" ref="revealButton" class="btn btn-primary" :disabled="loading" @click="reveal">{{ loading ? 'Consultando…' : 'Ver mi destinatario' }}</button>
    <button v-if="loading || result" class="btn btn-outline-primary ms-2" @click="hide">Ocultar destinatario</button>
    <div v-if="result || error" ref="messageElement" tabindex="-1" class="mt-3">
      <p v-if="result" class="recipient-name" role="status">Te toca regalar a <strong>{{ result.recipient.displayName }}</strong>.</p>
      <p v-if="error" class="alert alert-info" role="status">{{ error }}</p>
    </div>
    <p class="form-text mt-3">Ocultar elimina el resultado de esta pantalla. Volver a mostrarlo realiza una consulta nueva al servidor.</p>
  </div></section>
</template>
