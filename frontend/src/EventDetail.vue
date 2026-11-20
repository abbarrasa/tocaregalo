<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { ApiError, errorMessage } from './api.ts';
import type { EventClient, GroupEvent } from './event-client.ts';
import { formatEventTime } from './event-time.ts';
import EventLifecycle from './EventLifecycle.vue';
import type { EventLifecycleClient } from './event-lifecycle-client.ts';
import type { GroupClient } from './group-client.ts';
const props = defineProps<{ eventId: string; client: Pick<EventClient, 'find'>; lifecycle: EventLifecycleClient; groups: Pick<GroupClient, 'find'>; actorId: string }>();
const emit = defineEmits<{ expired: []; busy: [value: boolean] }>();
const event = shallowRef<GroupEvent | null>(null); const loading = ref(true); const error = ref(''); let generation = 0;
function unavailable() { generation++; event.value = null; loading.value = false; error.value = 'El evento no existe o ya no tienes acceso.'; emit('busy', false); }
async function load() {
  const request = ++generation; event.value = null; loading.value = true; error.value = '';
  try { const found = await props.client.find(props.eventId); if (request === generation) event.value = found; }
  catch (failure) {
    if (request !== generation) return;
    if (failure instanceof ApiError && failure.status === 401) emit('expired');
    else error.value = failure instanceof ApiError && failure.status === 404 ? 'El evento no existe o ya no tienes acceso.' : errorMessage(failure);
  } finally { if (request === generation) loading.value = false; }
}
onMounted(() => { void load(); }); onBeforeUnmount(() => { generation++; });
</script>
<template>
  <section class="groups-screen" :aria-busy="loading">
    <a href="#groups" class="back-link">Volver a mis grupos</a>
    <p v-if="loading" role="status" class="mt-4">Cargando evento…</p>
    <div v-else-if="error" role="alert" class="alert alert-danger mt-4">{{ error }} <button class="btn btn-outline-primary" @click="load">Reintentar</button></div>
    <article v-else-if="event" class="card mt-4"><div class="card-body">
      <p class="eyebrow">UNA NUEVA OCASIÓN PARA SORPRENDER</p><h1>Detalle del evento</h1>
      <dl class="mt-4"><dt>Identificador</dt><dd class="event-id">{{ event.id }}</dd><dt>Fecha de creación</dt><dd>{{ formatEventTime(event.createdAtMs) }} · No se puede modificar</dd>
        <dt>Cierre programado</dt><dd>{{ event.closureAtMs === null ? 'Sin cierre programado' : formatEventTime(event.closureAtMs) }}</dd></dl>
      <p class="text-muted">Las fechas se muestran en la zona horaria del navegador. La fecha programada es una previsión para el cierre automático y no confirma el cierre efectivo.</p>
      <a :href="'#groups/' + encodeURIComponent(event.groupId) + '/events'" class="btn btn-outline-primary">Ver eventos del grupo</a>
      <EventLifecycle :key="event.id" :event-id="event.id" :group-id="event.groupId" :actor-id="actorId" :groups="groups" :client="lifecycle"
        @expired="emit('expired')" @unavailable="unavailable" @busy="emit('busy', $event)" />
    </div></article>
  </section>
</template>
