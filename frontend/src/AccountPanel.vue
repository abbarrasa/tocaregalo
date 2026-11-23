<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue';
import { ApiError, errorMessage, type Account, type AuthClient } from './api.ts';
import { fieldError } from './form-errors.ts';
const props = defineProps<{ account: Account; client: AuthClient }>();
const emit = defineEmits<{ refresh: []; expired: []; logout: []; busy: [value: boolean] }>();
const busy = ref(false); const error = ref(''); const notice = ref(''); const token = ref('');
const errorElement = ref<HTMLElement>();
const profileErrorElement = ref<HTMLElement>();
const profileFieldErrors = ref<Record<string, string>>({});
const editingProfile = ref(false);
const profile = reactive({
  name: props.account.displayName,
  lastName: props.account.lastName ?? '',
  email: props.account.email,
  phone: props.account.phone ?? '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const passwordChangeRequested = computed(() => profile.newPassword !== '' || profile.confirmPassword !== '' || profile.currentPassword !== '');
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

async function saveProfile() {
  if (!active || busy.value) return;
  busy.value = true; emit('busy', true); error.value = ''; notice.value = ''; profileFieldErrors.value = {};
  try {
    if ([...profile.name.trim()].length < 1 || profile.name.trim().length > 100) {
      profileFieldErrors.value.name = 'El nombre debe tener entre 1 y 100 caracteres.';
      throw new Error('Invalid name');
    }
    if ([...profile.lastName.trim()].length > 100) {
      profileFieldErrors.value.lastName = 'Los apellidos deben tener como máximo 100 caracteres.';
      throw new Error('Invalid last name');
    }
    const normalizedPhone = profile.phone.trim().replace(/[\\s()-]/g, '');
    if (normalizedPhone && /^\+[1-9][0-9]{1,14}$/.test(normalizedPhone) === false) {
      profileFieldErrors.value.phone = 'Introduce un teléfono internacional válido que empiece por +.';
      throw new Error('Invalid phone');
    }
    if (passwordChangeRequested.value) {
      if (!profile.currentPassword) throw new Error('Invalid current password');
      if ([...profile.newPassword].length < 6) throw new Error('Invalid new password');
      if (profile.newPassword !== profile.confirmPassword) throw new Error('Password mismatch');
    }
    const result = await props.client.updateProfile({
      name: profile.name,
      email: profile.email,
      ...(profile.lastName.trim() ? { lastName: profile.lastName } : {}),
      ...(profile.phone.trim() ? { phone: profile.phone } : {}),
      ...(passwordChangeRequested.value ? {
        currentPassword: profile.currentPassword,
        newPassword: profile.newPassword,
      } : {}),
    });
    profile.currentPassword = ''; profile.newPassword = ''; profile.confirmPassword = '';
    editingProfile.value = false;
    if (result.passwordChanged) emit('logout');
    else { notice.value = 'Datos de perfil actualizados.'; emit('refresh'); }
  } catch (failure) {
    if (!active) return;
    if (failure instanceof ApiError && failure.status === 401) emit('expired');
    else {
      if (failure instanceof ApiError) profileFieldErrors.value = { ...failure.fields };
      const message = failure instanceof ApiError && Object.keys(profileFieldErrors.value).length
        ? 'Revisa los campos indicados.'
        : failure instanceof Error && failure.message === 'Invalid name' ? 'El nombre debe tener entre 1 y 100 caracteres.'
        : failure instanceof Error && failure.message === 'Invalid last name' ? 'Los apellidos deben tener como máximo 100 caracteres.'
        : failure instanceof Error && failure.message === 'Invalid phone' ? 'Introduce un teléfono internacional válido.'
        : failure instanceof Error && failure.message === 'Invalid current password' ? 'Introduce tu contraseña actual.'
        : failure instanceof Error && failure.message === 'Invalid new password' ? 'La nueva contraseña debe tener al menos seis caracteres.'
        : failure instanceof Error && failure.message === 'Password mismatch' ? 'Las contraseñas nuevas deben coincidir.'
        : errorMessage(failure, 'Revisa los datos o la contraseña actual e inténtalo de nuevo.');
      error.value = message;
      await nextTick(); if (active) profileErrorElement.value?.focus();
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
          <dl v-if="!editingProfile" class="profile-list mt-4">
            <div><dt>Nombre</dt><dd>{{ account.displayName }} {{ account.lastName }}</dd></div>
            <div><dt>Correo electrónico</dt><dd>{{ account.email }}</dd></div>
            <div><dt>Teléfono</dt><dd>{{ account.phone ?? 'No indicado' }}</dd></div>
          </dl>
          <button v-if="!editingProfile" class="btn btn-outline-primary mt-3" :disabled="busy" @click="editingProfile = true">Modificar datos</button>
          <form v-else class="mt-4" :aria-busy="busy" @submit.prevent="saveProfile">
            <fieldset :disabled="busy">
              <p v-if="error" ref="profileErrorElement" class="alert alert-danger" role="alert" tabindex="-1">{{ error }}</p>
              <div class="mb-3"><label for="profile-name" class="form-label">Nombre</label><input id="profile-name" v-model="profile.name" class="form-control" :class="{ 'is-invalid': fieldError(profileFieldErrors, 'name') }" autocomplete="given-name" required><div v-if="fieldError(profileFieldErrors, 'name')" class="invalid-feedback d-block">{{ fieldError(profileFieldErrors, 'name') }}</div></div>
              <div class="mb-3"><label for="profile-last-name" class="form-label">Apellidos</label><input id="profile-last-name" v-model="profile.lastName" class="form-control" :class="{ 'is-invalid': fieldError(profileFieldErrors, 'lastName') }" autocomplete="family-name"><div v-if="fieldError(profileFieldErrors, 'lastName')" class="invalid-feedback d-block">{{ fieldError(profileFieldErrors, 'lastName') }}</div></div>
              <div class="mb-3"><label for="profile-email" class="form-label">Correo electrónico</label><input id="profile-email" v-model="profile.email" type="email" class="form-control" :class="{ 'is-invalid': fieldError(profileFieldErrors, 'email') }" autocomplete="email" required><div v-if="fieldError(profileFieldErrors, 'email')" class="invalid-feedback d-block">{{ fieldError(profileFieldErrors, 'email') }}</div></div>
              <div class="mb-3"><label for="profile-phone" class="form-label">Teléfono</label><input id="profile-phone" v-model="profile.phone" type="tel" class="form-control" :class="{ 'is-invalid': fieldError(profileFieldErrors, 'phone') }" autocomplete="tel" placeholder="+34600000101"><div v-if="fieldError(profileFieldErrors, 'phone')" class="invalid-feedback d-block">{{ fieldError(profileFieldErrors, 'phone') }}</div></div>
              <hr>
              <p class="text-muted">Para cambiar la contraseña, completa los tres campos.</p>
              <div class="mb-3"><label for="profile-current-password" class="form-label">Contraseña actual</label><input id="profile-current-password" v-model="profile.currentPassword" type="password" class="form-control" :class="{ 'is-invalid': fieldError(profileFieldErrors, 'currentPassword') }" autocomplete="current-password"><div v-if="fieldError(profileFieldErrors, 'currentPassword')" class="invalid-feedback d-block">{{ fieldError(profileFieldErrors, 'currentPassword') }}</div></div>
              <div class="mb-3"><label for="profile-new-password" class="form-label">Nueva contraseña</label><input id="profile-new-password" v-model="profile.newPassword" type="password" class="form-control" :class="{ 'is-invalid': fieldError(profileFieldErrors, 'newPassword') }" autocomplete="new-password"><div v-if="fieldError(profileFieldErrors, 'newPassword')" class="invalid-feedback d-block">{{ fieldError(profileFieldErrors, 'newPassword') }}</div></div>
              <div class="mb-3"><label for="profile-confirm-password" class="form-label">Confirmar nueva contraseña</label><input id="profile-confirm-password" v-model="profile.confirmPassword" type="password" class="form-control" :class="{ 'is-invalid': fieldError(profileFieldErrors, 'confirm') }" autocomplete="new-password"><div v-if="fieldError(profileFieldErrors, 'confirm')" class="invalid-feedback d-block">{{ fieldError(profileFieldErrors, 'confirm') }}</div></div>
              <button type="submit" class="btn btn-primary">Guardar datos</button>
              <button type="button" class="btn btn-outline-secondary ms-2" @click="editingProfile = false">Cancelar</button>
            </fieldset>
          </form>
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
