<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ApiError, errorMessage } from './api.ts';
import type { InvitationClient } from './invitation-client.ts';
import { usePage } from './use-page.ts';
import PageControls from './PageControls.vue';
const props = defineProps<{ groupId: string; client: InvitationClient }>();
const emit = defineEmits<{ expired: []; unavailable: []; busy: [value: boolean] }>();
const { data, loading, error, cursor, fetchPage, clear } = usePage(after => props.client.list(props.groupId, after), () => emit('expired'), () => emit('unavailable'));
const email = ref(''); const busy = ref(false); const formError = ref(''); const notice = ref('');
const selected = ref<string | null>(null); const errorElement = ref<HTMLElement>();
const confirmationElement = ref<HTMLElement>();
let revokeTrigger: HTMLElement | null = null;
let active = true;
onBeforeUnmount(() => { active = false; selected.value = null; email.value = ''; });
onMounted(() => { void fetchPage(); });
const labels = { pending: 'Pendiente', expired: 'Caducada', accepted: 'Aceptada' };
async function askRevoke(address: string, event: Event) {
  revokeTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  selected.value = address; await nextTick(); confirmationElement.value?.focus();
}
function cancelRevoke() { selected.value = null; revokeTrigger?.focus(); revokeTrigger = null; }
function date(ms: number) {
  const value = new Date(ms); return Number.isNaN(value.getTime()) ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}
async function mutate(operation: () => Promise<void>, message: string) {
  if (busy.value) return;
  busy.value = true; emit('busy', true); formError.value = ''; notice.value = ''; clear();
  try {
    await operation();
    if (!active) return;
    notice.value = message; selected.value = null; await fetchPage();
  } catch (failure) {
    if (!active) return;
    if (failure instanceof ApiError && failure.status === 401) emit('expired');
    else if (failure instanceof ApiError && failure.status === 404) emit('unavailable');
    else {
      formError.value = errorMessage(failure, 'Revisa el correo de la invitación.');
      selected.value = null; await nextTick(); errorElement.value?.focus();
    }
  } finally { if (active) { busy.value = false; emit('busy', false); } }
}
async function send() {
  const address = email.value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254) {
    formError.value = 'Introduce un correo electrónico válido.'; await nextTick(); errorElement.value?.focus(); return;
  }
  await mutate(() => props.client.send(props.groupId, address), 'Resend ha aceptado la solicitud de envío. Esto no confirma la entrega en el buzón.');
}
async function revoke() {
  const address = selected.value; if (!address) return;
  await mutate(() => props.client.revoke(props.groupId, address), 'Revocación procesada. No se han retirado miembros del grupo.');
}
</script>
<template>
  <section class="owner-invitations card mt-5" aria-labelledby="invitations-title" :aria-busy="loading || busy">
    <div class="card-body">
      <p class="eyebrow">AMPLÍA EL CÍRCULO</p><h2 id="invitations-title">Invitaciones</h2>
      <p class="text-muted mt-3">Invita por correo. La persona deberá aceptar desde una cuenta con esa misma dirección.</p>
      <p class="form-text">Caducan a los siete días. Enviar otra al mismo correo sustituye el código anterior. Límite: cinco por grupo y correo y treinta por propietario cada quince minutos.</p>
      <form class="invitation-send-form" @submit.prevent="send"><fieldset :disabled="busy">
        <label for="invitation-email" class="form-label">Correo de la persona invitada</label>
        <input id="invitation-email" v-model="email" name="email" class="form-control" type="email" required maxlength="254" autocomplete="off">
        <button type="submit" class="btn btn-primary mt-3">{{ busy ? 'Procesando…' : 'Enviar invitación' }}</button>
      </fieldset></form>
      <p v-if="notice" class="alert alert-success mt-3" role="status">{{ notice }}</p>
      <p v-if="formError" ref="errorElement" class="alert alert-danger mt-3" role="alert" tabindex="-1">{{ formError }}</p>
      <div v-if="selected" class="revocation-confirmation mt-4" role="group" aria-labelledby="revoke-title">
        <h3 id="revoke-title" ref="confirmationElement" tabindex="-1">¿Revocar la invitación a {{ selected }}?</h3><p>El código dejará de permitir el acceso si la invitación sigue pendiente. Una aceptación ya completada conserva la membresía.</p>
        <button class="btn btn-primary" :disabled="busy" @click="revoke">Confirmar revocación</button>
        <button class="btn btn-outline-primary ms-2" :disabled="busy" @click="cancelRevoke">Cancelar</button>
      </div>
      <div class="d-flex justify-content-between align-items-center gap-3 mt-4 mb-3"><h3>Invitaciones del grupo</h3><button class="btn btn-outline-primary" :disabled="loading || busy" @click="selected = null; fetchPage()">Actualizar invitaciones</button></div>
      <p v-if="busy" role="status">Procesando solicitud…</p>
      <p v-else-if="loading" role="status">Cargando invitaciones…</p>
      <div v-else-if="error" class="alert alert-danger" role="alert">{{ error }} <button class="btn btn-outline-primary mt-2" @click="fetchPage(cursor)">Reintentar</button></div>
      <template v-else-if="data">
        <p v-if="!data.items.length">No hay invitaciones en esta página.</p>
        <ul v-else class="list-unstyled invitation-list"><li v-for="invitation in data.items" :key="invitation.email" class="member-row">
          <div><h3>{{ invitation.email }}</h3><p class="text-muted mb-0">Creada: {{ date(invitation.createdAtMs) }} · Caduca: {{ date(invitation.expiresAtMs) }}</p></div>
          <span class="status-pill" :class="{ verified: invitation.status === 'accepted' }">{{ labels[invitation.status] }}</span>
          <button v-if="invitation.status === 'pending'" class="btn btn-outline-primary" :disabled="busy" @click="askRevoke(invitation.email, $event)">Revocar<span class="visually-hidden"> {{ invitation.email }}</span></button>
        </li></ul>
      </template>
      <PageControls :cursor="cursor" :next-cursor="data?.nextCursor ?? null" :loading="loading || busy" @restart="selected = null; fetchPage()" @next="selected = null; fetchPage(data?.nextCursor ?? null)" />
    </div>
  </section>
</template>
