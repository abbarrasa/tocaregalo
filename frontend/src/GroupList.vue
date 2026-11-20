<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ApiError, errorMessage } from './api.ts';
import type { GroupClient } from './group-client.ts';
import { usePage } from './use-page.ts';
import PageControls from './PageControls.vue';
const props = defineProps<{ client: GroupClient; actorId: string }>();
const emit = defineEmits<{ expired: []; busy: [value: boolean] }>();
const { data, loading, error, cursor, fetchPage } = usePage(after => props.client.list(after), () => emit('expired'));
const name = ref(''); const saving = ref(false); const formError = ref(''); const errorElement = ref<HTMLElement>();
let active = true;
onBeforeUnmount(() => { active = false; });
onMounted(() => { void fetchPage(); });
async function create() {
  if (saving.value) return;
  formError.value = '';
  const trimmed = name.value.trim();
  if (!trimmed || trimmed.length > 100) {
    formError.value = 'Indica un nombre de entre 1 y 100 caracteres.';
    await nextTick(); errorElement.value?.focus(); return;
  }
  saving.value = true; emit('busy', true);
  try {
    const group = await props.client.create(trimmed);
    if (active) { name.value = ''; location.hash = '#groups/' + encodeURIComponent(group.id); }
  } catch (failure) {
    if (!active) return;
    if (failure instanceof ApiError && failure.status === 401) emit('expired');
    else {
      formError.value = errorMessage(failure, 'Revisa el nombre del grupo.');
      await nextTick(); errorElement.value?.focus();
    }
  } finally { if (active) { saving.value = false; emit('busy', false); } }
}
</script>
<template>
  <div class="groups-screen">
    <section class="groups-welcome"><p class="eyebrow">LAS SORPRESAS SE ORGANIZAN EN COMPAÑÍA</p><h1>Mis grupos</h1><p>Un lugar para cada intercambio, un detalle para cada persona.</p></section>
    <div class="groups-layout">
      <section aria-labelledby="groups-title" :aria-busy="loading">
        <div class="d-flex justify-content-between align-items-center gap-3 mb-4"><h2 id="groups-title">Tus grupos</h2><button class="btn btn-outline-primary" :disabled="loading" @click="fetchPage()">Actualizar</button></div>
        <p v-if="loading" role="status">Cargando grupos…</p>
        <div v-else-if="error" class="alert alert-danger" role="alert">{{ error }} <button class="btn btn-outline-primary mt-2" @click="fetchPage(cursor)">Reintentar</button></div>
        <template v-else-if="data">
          <div v-if="!data.items.length" class="card"><div class="card-body"><h3>{{ cursor === null ? 'Todavía no tienes grupos' : 'No hay más grupos en esta página' }}</h3><p class="text-muted mt-2 mb-0">{{ cursor === null ? 'Crea tu primer grupo para empezar a organizar un intercambio.' : 'Puedes volver al principio para actualizar el listado.' }}</p></div></div>
          <ul v-else class="group-cards list-unstyled">
            <li v-for="group in data.items" :key="group.id" class="card"><div class="card-body">
              <span class="status-pill" :class="{ verified: group.ownerAccountId === actorId }">{{ group.ownerAccountId === actorId ? 'Propietario' : 'Participante' }}</span>
              <h3 class="mt-3">{{ group.name }}</h3>
              <a class="btn btn-outline-primary mt-3" :href="'#groups/' + encodeURIComponent(group.id)">Ver grupo<span class="visually-hidden"> {{ group.name }}</span></a>
            </div></li>
          </ul>
        </template>
        <PageControls :cursor="cursor" :next-cursor="data?.nextCursor ?? null" :loading="loading" @restart="fetchPage()" @next="fetchPage(data?.nextCursor ?? null)" />
      </section>
      <section class="card create-group-card" aria-labelledby="create-group-title"><div class="card-body">
        <p class="eyebrow">UNA NUEVA TRADICIÓN</p><h2 id="create-group-title">Crea un grupo</h2><p class="text-muted mt-3">Dale un nombre que os haga sonreír. Serás su propietario y su primer miembro.</p>
        <form @submit.prevent="create" :aria-busy="saving"><fieldset :disabled="saving">
          <label for="group-name" class="form-label">Nombre del grupo</label><input id="group-name" v-model="name" name="name" class="form-control" required maxlength="100" autocomplete="off" aria-describedby="group-name-hint">
          <p id="group-name-hint" class="form-text">Entre 1 y 100 caracteres.</p>
          <p v-if="formError" ref="errorElement" class="alert alert-danger" role="alert" tabindex="-1">{{ formError }}</p>
          <button class="btn btn-primary w-100" type="submit">{{ saving ? 'Creando…' : 'Crear grupo' }}</button>
        </fieldset></form>
      </div></section>
    </div>
  </div>
</template>
