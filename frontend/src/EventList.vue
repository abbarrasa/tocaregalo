<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { ApiError, errorMessage } from './api.ts';
import type { EventClient } from './event-client.ts';
import type { Group, GroupClient } from './group-client.ts';
import { formatEventTime, localClosureTime } from './event-time.ts';
import { usePage } from './use-page.ts';
import PageControls from './PageControls.vue';
const props = defineProps<{ groupId: string; actorId: string; client: EventClient; groups: Pick<GroupClient, 'find'> }>();
const emit = defineEmits<{ expired: []; busy: [value: boolean] }>();
const group = shallowRef<Group | null>(null); const groupLoading = ref(true); const groupError = ref('');
const saving = ref(false); const scheduled = ref(false); const closure = ref(''); const formError = ref('');
const errorElement = ref<HTMLElement>(); const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let generation = 0;
function unavailable() { generation++; clear(); group.value = null; saving.value = false; groupLoading.value = false; groupError.value = 'El grupo no existe o ya no tienes acceso.'; emit('busy', false); }
const { data, loading, error, cursor, fetchPage, clear } = usePage(after => props.client.list(props.groupId, after), () => emit('expired'), unavailable);
async function load() {
  const request = ++generation; clear(); group.value = null; groupLoading.value = true; groupError.value = ''; formError.value = '';
  try {
    const found = await props.groups.find(props.groupId);
    if (request !== generation) return;
    group.value = found; groupLoading.value = false; await fetchPage();
  } catch (failure) {
    if (request !== generation) return;
    if (failure instanceof ApiError && failure.status === 401) emit('expired');
    else if (failure instanceof ApiError && failure.status === 404) unavailable();
    else groupError.value = errorMessage(failure);
  } finally { if (request === generation) groupLoading.value = false; }
}
async function create() {
  if (saving.value || group.value?.ownerAccountId !== props.actorId) return;
  formError.value = '';
  const closureAtMs = scheduled.value ? localClosureTime(closure.value) : null;
  if (scheduled.value && (closureAtMs === null || closureAtMs <= Date.now())) {
    formError.value = 'Indica una fecha y hora local válidas, posteriores al momento actual.';
    await nextTick(); errorElement.value?.focus(); return;
  }
  const request = generation; saving.value = true; emit('busy', true); clear();
  try {
    const event = await props.client.create(props.groupId, closureAtMs);
    if (request === generation) location.hash = '#events/' + encodeURIComponent(event.id);
  } catch (failure) {
    if (request !== generation) return;
    if (failure instanceof ApiError && failure.status === 401) emit('expired');
    else if (failure instanceof ApiError && failure.status === 404) unavailable();
    else { formError.value = errorMessage(failure, 'Revisa la fecha de cierre; debe seguir siendo futura al llegar al servidor.'); await nextTick(); errorElement.value?.focus(); }
  } finally { if (request === generation) { saving.value = false; emit('busy', false); } }
}
onMounted(() => { void load(); });
onBeforeUnmount(() => { generation++; emit('busy', false); });
</script>
<template>
  <section class="groups-screen" :aria-busy="groupLoading">
    <a :href="'#groups/' + encodeURIComponent(groupId)" class="back-link">Volver al grupo</a>
    <p v-if="groupLoading" role="status" class="mt-4">Cargando grupo…</p>
    <div v-else-if="groupError" role="alert" class="alert alert-danger mt-4">{{ groupError }} <button class="btn btn-outline-primary" @click="load">Reintentar</button></div>
    <template v-else-if="group">
      <header class="groups-welcome mt-4"><p class="eyebrow">PREPARA LA PRÓXIMA SORPRESA</p><h1>Eventos de {{ group.name }}</h1><p>Los más recientes primero, por fecha de creación.</p></header>
      <section v-if="group.ownerAccountId === actorId" class="card mb-4" aria-labelledby="create-event-title"><div class="card-body">
        <h2 id="create-event-title">Crear evento</h2><p class="text-muted mt-3">Participarán todos los miembros del grupo. Crear el evento no realiza el sorteo.</p>
        <form @submit.prevent="create"><fieldset :disabled="saving">
          <div class="form-check"><input id="event-scheduled" v-model="scheduled" type="checkbox" class="form-check-input"><label for="event-scheduled" class="form-check-label">Programar cierre automático</label></div>
          <div v-if="scheduled" class="mt-3"><label for="event-closure" class="form-label">Fecha y hora de cierre</label>
            <input id="event-closure" v-model="closure" type="datetime-local" step="60" required class="form-control" aria-describedby="event-zone">
            <p id="event-zone" class="form-text">Zona del navegador: {{ zone }}. En horas repetidas por cambio de horario se utiliza la primera ocurrencia.</p>
          </div>
          <p class="form-text">Sin programación, el evento no tendrá fecha de cierre automático. La fecha de creación la establece el servidor y no se puede modificar.</p>
          <p class="form-text">Si no recibes confirmación, actualiza el listado antes de volver a crear el evento.</p>
          <p v-if="formError" ref="errorElement" role="alert" tabindex="-1" class="alert alert-danger">{{ formError }}</p>
          <button type="submit" class="btn btn-primary mt-2">{{ saving ? 'Creando…' : 'Crear evento' }}</button>
        </fieldset></form>
      </div></section>
      <section aria-labelledby="events-title" :aria-busy="loading || saving">
        <div class="d-flex justify-content-between align-items-center gap-3 mb-3"><h2 id="events-title">Eventos del grupo</h2><button class="btn btn-outline-primary" :disabled="loading || saving" @click="fetchPage()">Actualizar eventos</button></div>
        <p v-if="loading" role="status">Cargando eventos…</p>
        <div v-else-if="error" role="alert" class="alert alert-danger">{{ error }} <button class="btn btn-outline-primary" :disabled="saving" @click="fetchPage(cursor)">Reintentar</button></div>
        <template v-else-if="data">
          <p v-if="!data.items.length" class="card card-body">{{ cursor === null ? 'Todavía no hay eventos en este grupo.' : 'No hay eventos en esta página.' }}</p>
          <ul v-else class="list-unstyled group-cards"><li v-for="event in data.items" :key="event.id" class="card"><div class="card-body">
            <h3>Evento <span class="event-id">{{ event.id }}</span></h3><p class="mt-3">Creado: {{ formatEventTime(event.createdAtMs) }}</p>
            <p>{{ event.closureAtMs === null ? 'Sin cierre programado' : 'Cierre programado: ' + formatEventTime(event.closureAtMs) }}</p>
            <a class="btn btn-outline-primary" :href="'#events/' + encodeURIComponent(event.id)">Ver evento<span class="visually-hidden">{{ ' ' + event.id }}</span></a>
          </div></li></ul>
        </template>
        <PageControls :cursor="cursor" :next-cursor="data?.nextCursor ?? null" :loading="loading || saving" @restart="fetchPage()" @next="fetchPage(data?.nextCursor ?? null)" />
        <p class="form-text mt-3">La fecha programada no confirma que el evento esté cerrado. El procesamiento automático puede demorarse.</p>
      </section>
    </template>
  </section>
</template>
