<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { ApiError, errorMessage } from './api.ts';
import type { EventLifecycleClient, EventState } from './event-lifecycle-client.ts';
import type { GroupClient } from './group-client.ts';
import { formatEventTime } from './event-time.ts';
const props = defineProps<{ eventId: string; groupId: string; actorId: string; client: EventLifecycleClient; groups: Pick<GroupClient, 'find'> }>();
const emit = defineEmits<{ expired: []; unavailable: []; busy: [value: boolean] }>();
const state = shallowRef<EventState | null>(null); const owner = ref(false); const loading = ref(false); const busy = ref(false);
const error = ref(''); const notice = ref(''); const selected = ref<'draw' | 'close' | null>(null);
const confirmationElement = ref<HTMLElement>(); const messageElement = ref<HTMLElement>(); let trigger: HTMLElement | null = null; let generation = 0;
const labels = { pending: 'Pendiente de sorteo actualizado', ready: 'Sorteo actualizado', closed: 'Cerrado' };
function accessFailure(failure: unknown): boolean {
  if (failure instanceof ApiError && (failure.status === 401 || failure.status === 404)) {
    generation++; state.value = null; owner.value = false; selected.value = null; busy.value = false; loading.value = false;
    emit('busy', false); if (failure.status === 401) emit('expired'); else emit('unavailable'); return true;
  }
  return false;
}
async function readCurrent(request: number) {
  const group = await props.groups.find(props.groupId); if (request !== generation) return;
  owner.value = group.ownerAccountId === props.actorId;
  const current = await props.client.state(props.eventId); if (request === generation) state.value = current;
}
async function refresh() {
  if (busy.value) return;
  const request = ++generation; state.value = null; owner.value = false; selected.value = null; error.value = ''; loading.value = true;
  try {
    await readCurrent(request);
  } catch (failure) {
    if (request !== generation || accessFailure(failure)) return;
    error.value = errorMessage(failure);
  } finally { if (request === generation) loading.value = false; }
}
async function ask(operation: 'draw' | 'close', event: Event) {
  if (!owner.value || !state.value || state.value.status === 'closed' || busy.value || loading.value) return;
  trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  selected.value = operation; await nextTick(); confirmationElement.value?.focus();
}
function cancel() { selected.value = null; trigger?.focus(); trigger = null; }
async function execute() {
  const operation = selected.value;
  if (!operation || !owner.value || !state.value || state.value.status === 'closed' || busy.value || loading.value) return;
  const request = ++generation; busy.value = true; emit('busy', true); state.value = null; error.value = ''; notice.value = '';
  try {
    const result = await props.client[operation](props.eventId); if (request !== generation) return;
    state.value = result;
    notice.value = operation === 'close' ? 'Cierre confirmado por el servidor. Las asignaciones han quedado fijadas.' : 'Sorteo actualizado confirmado por el servidor. Sin cambios de miembros se conserva el mismo sorteo.';
  } catch (failure) {
    if (request !== generation || accessFailure(failure)) return;
    notice.value = failure instanceof ApiError && failure.status === 409
      ? 'No se pudo completar la operación: el evento puede estar cerrado, tener menos de tres miembros o haber cambiado su membresía. Se consultará el estado actual.'
      : 'No se pudo confirmar la operación. Puede haberse procesado; se consultará el estado actual sin repetirla automáticamente.';
    // Read-only reconciliation: an HTTP/network error is not proof of rollback.
    try {
      await readCurrent(request);
    } catch (readFailure) {
      if (request !== generation || accessFailure(readFailure)) return;
      error.value = 'No se pudo consultar el estado actual. Actualízalo antes de intentar otra operación.';
    }
  } finally {
    if (request === generation) {
      selected.value = null; busy.value = false; emit('busy', false); await nextTick(); messageElement.value?.focus();
    }
  }
}
onMounted(() => { void refresh(); }); onBeforeUnmount(() => { generation++; emit('busy', false); });
</script>
<template>
  <section class="mt-4" aria-labelledby="lifecycle-title" :aria-busy="loading || busy">
    <div class="d-flex justify-content-between align-items-center gap-3 mb-3"><h2 id="lifecycle-title">Sorteo y cierre</h2><button class="btn btn-outline-primary" :disabled="loading || busy" @click="refresh">Actualizar estado</button></div>
    <p v-if="loading" role="status">Consultando estado…</p><p v-if="busy" role="status">Procesando y comprobando la operación…</p>
    <div v-if="notice || error" ref="messageElement" tabindex="-1"><p v-if="notice" class="alert alert-info" role="status">{{ notice }}</p><p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p></div>
    <template v-if="state">
      <p class="status-pill" :class="{ verified: state.status !== 'pending' }">{{ labels[state.status] }}</p>
      <p v-if="state.closedAtMs !== null" class="mt-3">Cierre efectivo: {{ formatEventTime(state.closedAtMs) }}</p>
      <p v-if="state.status === 'pending'" class="mt-3">Falta un sorteo vigente para los miembros actuales. Se necesitan al menos tres miembros.</p>
      <p v-else-if="state.status === 'ready'" class="mt-3">El sorteo corresponde a los miembros actuales. Mientras el evento esté abierto, los cambios de miembros pueden invalidarlo.</p>
      <p v-else class="mt-3">El evento está cerrado. Los cambios posteriores en el grupo conservan este sorteo.</p>
      <div v-if="owner && state.status !== 'closed'" class="d-flex flex-wrap gap-2">
        <button class="btn btn-primary" @click="ask('draw', $event)">Solicitar sorteo</button>
        <button class="btn btn-outline-primary" @click="ask('close', $event)">Cerrar evento</button>
      </div>
    </template>
    <div v-if="selected" class="revocation-confirmation mt-3" role="group" aria-labelledby="lifecycle-confirm-title">
      <h3 id="lifecycle-confirm-title" ref="confirmationElement" tabindex="-1">{{ selected === 'close' ? '¿Cerrar el evento?' : '¿Solicitar el sorteo?' }}</h3>
      <p>Participan todos los miembros del grupo, incluido el propietario. Se necesitan al menos tres.</p>
      <p v-if="selected === 'close'">Puedes cerrar antes de la fecha programada. El servidor creará o reutilizará un sorteo actualizado y fijará las asignaciones. El cierre no se puede deshacer.</p>
      <p v-else>Se sortea con los miembros actuales. Sin cambios de membresía se reutiliza el sorteo existente; no se repite para obtener otro resultado.</p>
      <button class="btn btn-primary" :disabled="busy" @click="execute">{{ selected === 'close' ? 'Confirmar cierre' : 'Confirmar sorteo' }}</button>
      <button class="btn btn-outline-primary ms-2" :disabled="busy" @click="cancel">Cancelar</button>
    </div>
  </section>
</template>
