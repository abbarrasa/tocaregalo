<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { ApiError, errorMessage } from './api.ts';
import type { InvitationClient } from './invitation-client.ts';
const props = defineProps<{ client: InvitationClient; email: string }>();
const emit = defineEmits<{ accepted: []; expired: []; busy: [value: boolean] }>();
const token = ref(''); const busy = ref(false); const error = ref(''); const errorElement = ref<HTMLElement>();
let active = true;
onBeforeUnmount(() => { active = false; token.value = ''; });
async function accept() {
  if (busy.value) return;
  error.value = '';
  const code = token.value.trim();
  if (!/^[a-f0-9]{64}$/.test(code)) {
    error.value = 'Copia el código completo recibido por correo.'; await nextTick(); errorElement.value?.focus(); return;
  }
  busy.value = true; emit('busy', true);
  try { await props.client.accept(code); if (active) { token.value = ''; emit('accepted'); } }
  catch (failure) {
    if (!active) return;
    if (failure instanceof ApiError && failure.status === 401) emit('expired');
    else {
      error.value = errorMessage(failure, 'La invitación no es válida, ha caducado, ya se utilizó o corresponde a otro correo.');
      await nextTick(); errorElement.value?.focus();
    }
  } finally { if (active) { busy.value = false; emit('busy', false); } }
}
</script>
<template>
  <section class="groups-screen acceptance-screen">
    <p class="eyebrow">HAY UN SITIO PARA TI</p><h1>Aceptar invitación</h1>
    <p class="text-muted mt-3">Introduce el código que has recibido por correo para unirte al grupo.</p>
    <div class="card mt-4"><div class="card-body">
      <p>Tu cuenta usa <strong>{{ email }}</strong>. Debe coincidir con el correo invitado. Si recibiste la invitación en otra dirección, inicia sesión con esa cuenta.</p>
      <p class="text-muted">El código caduca a los siete días y solo se puede utilizar una vez. Aceptar no verifica tu correo.</p>
      <form @submit.prevent="accept" :aria-busy="busy"><fieldset :disabled="busy">
        <label for="invitation-code" class="form-label">Código de invitación</label>
        <input id="invitation-code" v-model="token" class="form-control" name="token" required autocomplete="off" :spellcheck="false" autocapitalize="none" aria-describedby="invitation-code-hint">
        <p id="invitation-code-hint" class="form-text">Copia el código completo de 64 caracteres de tu correo.</p>
        <p v-if="error" ref="errorElement" class="alert alert-danger" role="alert" tabindex="-1">{{ error }}</p>
        <button type="submit" class="btn btn-primary">{{ busy ? 'Aceptando…' : 'Aceptar invitación' }}</button>
      </fieldset></form>
    </div></div>
  </section>
</template>
