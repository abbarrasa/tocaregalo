<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue';
import { errorMessage, type AuthClient } from './api.ts';

export type EntryPage = 'login' | 'register' | 'recover' | 'reset';
const props = defineProps<{ page: EntryPage; client: AuthClient }>();
const emit = defineEmits<{ authenticated: []; registered: []; reset: []; busy: [value: boolean] }>();
const values = reactive<Record<string, string>>({ identifier: '', name: '', lastName: '', email: '', phone: '', password: '', confirm: '', token: '' });
const busy = ref(false); const error = ref(''); const sent = ref(false); const errorElement = ref<HTMLElement>();
class FormInputError extends Error {}
const titles = { login: 'Iniciar sesión', register: 'Crea tu cuenta', recover: 'Recuperar contraseña', reset: 'Nueva contraseña' };
type Field = { id: string; label: string; type?: string; autocomplete?: string; required?: boolean; hint?: string };
const fields = computed<Field[]>(() => {
  const password: Field = { id: 'password', label: props.page === 'reset' ? 'Nueva contraseña' : 'Contraseña', type: 'password', required: true,
    autocomplete: props.page === 'login' ? 'current-password' : 'new-password', hint: props.page === 'login' ? undefined : 'Usa al menos seis caracteres.' };
  const confirmation: Field = { id: 'confirm', label: 'Confirmar contraseña', type: 'password', required: true, autocomplete: 'new-password' };
  if (props.page === 'login') return [{ id: 'identifier', label: 'Correo o teléfono', required: true, autocomplete: 'username' }, password];
  if (props.page === 'recover') return [{ id: 'identifier', label: 'Correo o teléfono de tu cuenta', required: true, autocomplete: 'username', hint: 'Enviaremos las instrucciones al correo guardado en la cuenta, si corresponde.' }];
  if (props.page === 'reset') return [{ id: 'token', label: 'Código de recuperación', required: true, autocomplete: 'off', hint: 'Copia el código recibido por correo.' }, password, confirmation];
  return [
    { id: 'name', label: 'Nombre', required: true, autocomplete: 'given-name' },
    { id: 'lastName', label: 'Apellidos (opcional)', autocomplete: 'family-name' },
    { id: 'email', label: 'Correo electrónico', type: 'email', required: true, autocomplete: 'email' },
    { id: 'phone', label: 'Teléfono (opcional)', type: 'tel', autocomplete: 'tel', hint: 'Incluye el prefijo internacional. Por ejemplo: +34600000101.' }, password, confirmation,
  ];
});
async function submit() {
  if (busy.value) return;
  error.value = ''; busy.value = true; emit('busy', true);
  try {
    if (props.page === 'register' || props.page === 'reset') {
      if ([...values.password].length < 6) throw new FormInputError('Usa al menos seis caracteres en la contraseña.');
      if (values.password !== values.confirm) throw new FormInputError('Las contraseñas deben coincidir.');
    }
    if (props.page === 'login') { await props.client.login(values.identifier, values.password); emit('authenticated'); }
    if (props.page === 'register') {
      await props.client.register({ name: values.name, email: values.email, password: values.password,
        ...(values.lastName ? { lastName: values.lastName } : {}), ...(values.phone ? { phone: values.phone } : {}) });
      emit('registered');
    }
    if (props.page === 'recover') { await props.client.recover(values.identifier); sent.value = true; }
    if (props.page === 'reset') { await props.client.reset(values.token.trim(), values.password); emit('reset'); }
    values.password = ''; values.confirm = ''; values.token = '';
  } catch (failure) {
    error.value = failure instanceof FormInputError ? failure.message
      : errorMessage(failure, props.page === 'reset' ? 'El código no es válido, ha caducado o ya se utilizó.' : undefined);
    await nextTick(); errorElement.value?.focus();
  } finally { busy.value = false; emit('busy', false); }
}
</script>

<template>
  <div>
    <p class="eyebrow">UN REGALO EMPIEZA CON UNA ILUSIÓN</p>
    <h2>{{ titles[page] }}</h2>
    <p class="text-muted mt-3" v-if="page === 'login'">Entra y sigue preparando tu próxima sorpresa.</p>
    <p class="text-muted mt-3" v-else-if="page === 'register'">Tu próximo intercambio empieza aquí.</p>
    <p class="text-muted mt-3" v-else-if="page === 'reset'">Introduce el código de tu correo y elige una contraseña nueva.</p>
    <div v-if="sent" class="alert alert-success mt-4" role="status">
      Si existe una cuenta con esos datos, recibirás instrucciones en su correo. Revisa también la carpeta de spam.
    </div>
    <form v-else class="mt-4" @submit.prevent="submit" :aria-busy="busy">
      <fieldset :disabled="busy">
        <div v-for="field in fields" :key="field.id" class="mb-3">
          <label :for="field.id" class="form-label">{{ field.label }}</label>
          <input :id="field.id" :name="field.id" v-model="values[field.id]" :type="field.type ?? 'text'"
            class="form-control" :required="field.required" :autocomplete="field.autocomplete"
            :aria-describedby="field.hint ? `${field.id}-hint` : undefined" :spellcheck="field.id === 'token' ? false : undefined">
          <div v-if="field.hint" :id="`${field.id}-hint`" class="form-text">{{ field.hint }}</div>
        </div>
        <p v-if="error" ref="errorElement" class="alert alert-danger" role="alert" tabindex="-1">{{ error }}</p>
        <button type="submit" class="btn btn-primary w-100">{{ busy ? 'Un momento…' : ({ login: 'Entrar', register: 'Crear cuenta', recover: 'Solicitar instrucciones', reset: 'Guardar contraseña' })[page] }}</button>
      </fieldset>
    </form>
    <nav class="entry-links" aria-label="Opciones de acceso">
      <template v-if="page === 'login'">
        <a href="#recover" :aria-disabled="busy">¿Has olvidado tu contraseña?</a>
        <p class="mt-4">¿Es tu primera vez? <a href="#register" :aria-disabled="busy">Crea tu cuenta</a></p>
      </template>
      <template v-else>
        <a v-if="page === 'recover'" href="#reset" :aria-disabled="busy">Ya tengo un código de recuperación</a>
        <a href="#login" :aria-disabled="busy">Volver al acceso</a>
      </template>
    </nav>
  </div>
</template>
