<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { ApiError, errorMessage, type Account, type AuthClient } from './api.ts';
defineProps<{ account: Account; client: AuthClient }>();
const emit = defineEmits<{ refresh: []; expired: []; logout: []; busy: [value: boolean] }>();
const busy = ref(false); const error = ref(''); const notice = ref(''); const token = ref('');
const errorElement = ref<HTMLElement>();
let active = true;
onBeforeUnmount(() => {
  active = false;
  token.value = '';
  // Refresh replaces this panel before the operation's finally can notify its parent.
  if (busy.value) { busy.value = false; emit('busy', false); }
});
async function perform(operation: () => Promise<void>, message: string) {
  if (!active || busy.value) return;
  busy.value = true; emit('busy', true); error.value = ''; notice.value = '';
  try { await operation(); if (active) notice.value = message; }
  catch (failure) {
    if (!active) return;
    if (failure instanceof ApiError && failure.status === 401) emit('expired');
    else {
      error.value = errorMessage(failure, 'El código no es válido, ha caducado o ya se utilizó.');
      await nextTick(); if (active) errorElement.value?.focus();
    }
  } finally { if (active) { busy.value = false; emit('busy', false); } }
}
</script>

<template>
  <div class="account-layout">
    <aside class="account-sidebar">
      <p class="eyebrow">TU ESPACIO</p>
      <h1>Hola,<br>{{ account.displayName }}</h1>
      <p class="mt-3">Cada sorpresa empieza por conectar con los demás.</p>
      <img src="/gift.svg" alt="" class="account-gift">
    </aside>
    <div class="account-content">
      <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-4">
        <h2>Mi cuenta</h2>
        <button class="btn btn-outline-primary" :disabled="busy" @click="perform(async () => { await client.logout(); if (active) emit('logout'); }, '')">Cerrar sesión</button>
      </div>
      <p v-if="error" ref="errorElement" role="alert" class="alert alert-danger" tabindex="-1">{{ error }}</p>
      <p v-if="notice" role="status" class="alert alert-success">{{ notice }}</p>
      <section class="card mb-4" aria-labelledby="profile-title">
        <div class="card-body">
          <p class="eyebrow">TUS DATOS</p><h3 id="profile-title">Todo listo para empezar</h3>
          <dl class="profile-list mt-4">
            <div><dt>Nombre</dt><dd>{{ account.displayName }} {{ account.lastName }}</dd></div>
            <div><dt>Correo electrónico</dt><dd>{{ account.email }}</dd></div>
            <div><dt>Teléfono</dt><dd>{{ account.phone ?? 'No indicado' }}</dd></div>
          </dl>
        </div>
      </section>
      <section class="card" aria-labelledby="verification-title">
        <div class="card-body">
          <span class="status-pill" :class="{ verified: account.emailVerifiedAtMs !== null }">{{ account.emailVerifiedAtMs !== null ? 'Correo verificado' : 'Verificación pendiente' }}</span>
          <h3 id="verification-title" class="mt-3">Tu correo, confirmado</h3>
          <p v-if="account.emailVerifiedAtMs !== null" class="text-muted mt-2">Ya has confirmado esta dirección de correo.</p>
          <template v-else>
            <p class="text-muted mt-2">Te enviaremos un código a {{ account.email }}. Puedes seguir usando tu cuenta mientras lo verificas.</p>
            <button class="btn btn-outline-primary mt-2" :disabled="busy"
              @click="perform(() => client.requestVerification(), 'Solicitud procesada. Si el correo aún no estaba verificado, recibirás un código; solicitar otro invalida el anterior.')">Solicitar código</button>
            <form class="mt-4" :aria-busy="busy" @submit.prevent="perform(async () => { await client.confirmVerification(token.trim()); token = ''; if (active) emit('refresh'); }, 'Correo confirmado.')">
              <fieldset :disabled="busy">
                <label for="verification-token" class="form-label">Código recibido por correo</label>
                <input id="verification-token" v-model="token" name="token" class="form-control" required autocomplete="off" :spellcheck="false">
                <button class="btn btn-primary mt-3" type="submit">Confirmar correo</button>
              </fieldset>
            </form>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
