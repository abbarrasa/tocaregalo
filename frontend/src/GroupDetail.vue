<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { ApiError, errorMessage } from './api.ts';
import type { Group, GroupClient, Member } from './group-client.ts';
import { usePage } from './use-page.ts';
import PageControls from './PageControls.vue';
import OwnerInvitations from './OwnerInvitations.vue';
import type { InvitationClient } from './invitation-client.ts';
const props = defineProps<{ groupId: string; actorId: string; client: GroupClient; invitationClient: InvitationClient }>();
const emit = defineEmits<{ expired: []; busy: [value: boolean] }>();
const group = shallowRef<Group | null>(null); const groupLoading = ref(false); const groupError = ref('');
const unavailable = 'El grupo no existe o ya no tienes acceso.';
const removing = ref(false); const invitationBusy = ref(false); const invitationVersion = ref(0);
const selected = shallowRef<Member | null>(null); const removalNotice = ref('');
const confirmationElement = ref<HTMLElement>(); const noticeElement = ref<HTMLElement>();
let removalTrigger: HTMLElement | null = null;
function hideUnavailable() { generation++; members.clear(); group.value = null; selected.value = null; removing.value = false; invitationBusy.value = false; groupLoading.value = false; groupError.value = unavailable; emit('busy', false); }
const members = usePage(after => props.client.members(props.groupId, after), () => emit('expired'), hideUnavailable);
const { data, loading, error, cursor, fetchPage } = members;
let generation = 0;
function invitationsBusy(value: boolean) { invitationBusy.value = value; emit('busy', value || removing.value); }
async function askRemoval(member: Member, event: Event) {
  if (removing.value || invitationBusy.value || member.isOwner || member.accountId === group.value?.ownerAccountId || group.value?.ownerAccountId !== props.actorId) return;
  removalTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  selected.value = member; await nextTick(); confirmationElement.value?.focus();
}
function cancelRemoval() { selected.value = null; removalTrigger?.focus(); removalTrigger = null; }
async function removeMember() {
  const target = selected.value;
  if (!target || removing.value || invitationBusy.value || group.value?.ownerAccountId !== props.actorId
    || target.isOwner || target.accountId === group.value.ownerAccountId) return;
  const request = generation; const id = props.groupId;
  removing.value = true; emit('busy', true); removalNotice.value = ''; members.clear();
  try {
    await props.client.removeMember(id, target.accountId);
    if (request !== generation) return;
    removalNotice.value = 'Retirada procesada. Las invitaciones pendientes vigentes de esa persona se han cancelado.';
  } catch (failure) {
    if (request !== generation) return;
    if (failure instanceof ApiError && failure.status === 401) { generation++; removing.value = false; selected.value = null; emit('busy', false); emit('expired'); return; }
    if (failure instanceof ApiError && failure.status === 404) { hideUnavailable(); return; }
    removalNotice.value = failure instanceof ApiError && failure.status === 409
      ? 'El propietario no se puede retirar del grupo.'
      : 'No se pudo confirmar el resultado. La retirada puede haberse aplicado y el recálculo de eventos puede seguir pendiente. Se actualizarán miembros e invitaciones; no se repetirá la retirada automáticamente.';
  } finally {
    if (request === generation) {
      selected.value = null; invitationVersion.value++;
      await fetchPage();
      if (request === generation) {
        removing.value = false; emit('busy', false); await nextTick(); noticeElement.value?.focus();
      }
    }
  }
}
async function loadGroup() {
  const request = ++generation; members.clear(); selected.value = null; removalNotice.value = ''; group.value = null; groupError.value = ''; groupLoading.value = true;
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
onBeforeUnmount(() => { generation++; emit('busy', false); });
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
        <div class="d-flex justify-content-between align-items-center gap-3 mb-3"><h2 id="members-title">Miembros del grupo</h2><button class="btn btn-outline-primary" :disabled="loading || removing || invitationBusy" @click="selected = null; fetchPage()">Actualizar miembros</button></div>
        <p v-if="removalNotice" ref="noticeElement" class="alert alert-info" role="status" tabindex="-1">{{ removalNotice }}</p>
        <div v-if="selected" class="revocation-confirmation mb-3" role="group" aria-labelledby="remove-member-title">
          <h3 id="remove-member-title" ref="confirmationElement" tabindex="-1">¿Retirar a {{ selected.displayName }} del grupo?</h3>
          <p>Perderá el acceso al grupo y se cancelarán sus invitaciones pendientes. Los eventos abiertos se recalcularán cuando haya al menos tres miembros; los cerrados conservarán su sorteo. Para volver necesitará aceptar una nueva invitación.</p>
          <button class="btn btn-primary" :disabled="removing || invitationBusy" @click="removeMember">Confirmar retirada</button>
          <button class="btn btn-outline-primary ms-2" :disabled="removing" @click="cancelRemoval">Cancelar</button>
        </div>
        <p v-if="removing" role="status">Procesando retirada y comprobando el estado…</p>
        <p v-if="loading" role="status">Cargando miembros…</p>
        <div v-else-if="error" role="alert" class="alert alert-danger">{{ error }} <button class="btn btn-outline-primary mt-2" @click="fetchPage(cursor)">Reintentar</button></div>
        <template v-else-if="data">
          <p v-if="!data.items.length" class="card card-body">No hay miembros en esta página.</p>
          <ul v-else class="list-unstyled card member-list"><li v-for="member in data.items" :key="member.accountId" class="member-row">
            <div><h3>{{ member.displayName }}<span v-if="member.accountId === actorId" class="text-muted"> (tú)</span></h3><p class="text-muted mb-0 mt-1">Se incorporó el {{ date(member.joinedAtMs) }}</p></div>
            <span v-if="member.isOwner" class="status-pill verified">Propietario</span>
            <button v-if="group.ownerAccountId === actorId && !member.isOwner && member.accountId !== group.ownerAccountId" class="btn btn-outline-primary" :disabled="removing || invitationBusy" @click="askRemoval(member, $event)">Retirar<span class="visually-hidden">{{ ' ' + member.displayName }}</span></button>
          </li></ul>
        </template>
        <PageControls :cursor="cursor" :next-cursor="data?.nextCursor ?? null" :loading="loading || removing || invitationBusy" @restart="selected = null; fetchPage()" @next="selected = null; fetchPage(data?.nextCursor ?? null)" />
      </section>
      <OwnerInvitations v-if="group.ownerAccountId === actorId && !removing" :key="group.id + ':' + invitationVersion" :group-id="group.id" :client="invitationClient"
        @busy="invitationsBusy" @expired="emit('expired')" @unavailable="hideUnavailable" />
    </template>
  </section>
</template>
