<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { ApiError, errorMessage } from './api.ts';
import type { Group, GroupClient } from './group-client.ts';
import { usePage } from './use-page.ts';
import PageControls from './PageControls.vue';
const props = defineProps<{ groupId: string; actorId: string; client: GroupClient }>();
const emit = defineEmits<{ expired: [] }>();
const group = shallowRef<Group | null>(null); const groupLoading = ref(false); const groupError = ref('');
const unavailable = 'El grupo no existe o ya no tienes acceso.';
const members = usePage(after => props.client.members(props.groupId, after), () => emit('expired'), () => {
  group.value = null; groupError.value = unavailable;
});
const { data, loading, error, cursor, fetchPage } = members;
let generation = 0;
async function loadGroup() {
  const request = ++generation; members.clear(); group.value = null; groupError.value = ''; groupLoading.value = true;
  const id = props.groupId;
  try {
    const found = await props.client.find(id);
    if (request !== generation) return;
    group.value = found; await fetchPage();
  } catch (failure) {
    if (request !== generation) return;
    if (failure instanceof ApiError && failure.status === 401) emit('expired');
    else groupError.value = failure instanceof ApiError && failure.status === 404 ? unavailable : errorMessage(failure);
  } finally { if (request === generation) groupLoading.value = false; }
}
watch(() => props.groupId, () => { void loadGroup(); }, { immediate: true });
onBeforeUnmount(() => { generation++; });
function date(value: number): string {
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(instant);
}
</script>
<template>
  <section class="groups-screen" :aria-busy="groupLoading">
    <a href="#groups" class="back-link">Volver a mis grupos</a>
    <p v-if="groupLoading" class="mt-4" role="status">Cargando grupo…</p>
    <div v-else-if="groupError" class="alert alert-danger mt-4" role="alert">{{ groupError }} <button class="btn btn-outline-primary mt-2" @click="loadGroup">Reintentar</button></div>
    <template v-else-if="group">
      <header class="groups-welcome mt-4"><p class="eyebrow">UN GRUPO, MUCHAS ILUSIONES</p><h1>{{ group.name }}</h1>
        <p><span class="status-pill" :class="{ verified: group.ownerAccountId === actorId }">{{ group.ownerAccountId === actorId ? 'Propietario' : 'Participante' }}</span><span class="ms-3">Creado el {{ date(group.createdAtMs) }}</span></p>
      </header>
      <section aria-labelledby="members-title" :aria-busy="loading" class="members-section">
        <div class="d-flex justify-content-between align-items-center gap-3 mb-3"><h2 id="members-title">Miembros del grupo</h2><button class="btn btn-outline-primary" :disabled="loading" @click="fetchPage()">Actualizar miembros</button></div>
        <p v-if="loading" role="status">Cargando miembros…</p>
        <div v-else-if="error" role="alert" class="alert alert-danger">{{ error }} <button class="btn btn-outline-primary mt-2" @click="fetchPage(cursor)">Reintentar</button></div>
        <template v-else-if="data">
          <p v-if="!data.items.length" class="card card-body">No hay miembros en esta página.</p>
          <ul v-else class="list-unstyled card member-list"><li v-for="member in data.items" :key="member.accountId" class="member-row">
            <div><h3>{{ member.displayName }}<span v-if="member.accountId === actorId" class="text-muted"> (tú)</span></h3><p class="text-muted mb-0 mt-1">Se incorporó el {{ date(member.joinedAtMs) }}</p></div>
            <span v-if="member.isOwner" class="status-pill verified">Propietario</span>
          </li></ul>
        </template>
        <PageControls :cursor="cursor" :next-cursor="data?.nextCursor ?? null" :loading="loading" @restart="fetchPage()" @next="fetchPage(data?.nextCursor ?? null)" />
      </section>
    </template>
  </section>
</template>
