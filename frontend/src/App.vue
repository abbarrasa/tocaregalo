<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ApiError, createAuthClient, errorMessage, type Account, type AuthClient } from './api.ts';
import AuthForm, { type EntryPage } from './AuthForm.vue';
import AccountPanel from './AccountPanel.vue';
import BrandMark from './BrandMark.vue';
const props = defineProps<{ client?: AuthClient }>();
const client = props.client ?? createAuthClient();
const account = ref<Account | null>(null); const loading = ref(true); const busy = ref(false);
const notice = ref(''); const error = ref(''); const heading = ref<HTMLElement>();
function readPage(): EntryPage {
  const hash = location.hash.slice(1);
  return hash === 'register' || hash === 'recover' || hash === 'reset' ? hash : 'login';
}
const page = ref<EntryPage>(readPage());
const captions = computed(() => page.value === 'register' ? 'Haz sitio a una nueva tradición.' : 'Descubre a quién te toca sorprender.');
async function focusContent() { await nextTick(); heading.value?.focus(); }
function navigate() {
  if (busy.value) { history.replaceState(null, '', '#' + page.value); return; }
  page.value = readPage(); error.value = ''; notice.value = ''; void focusContent();
}
function loginScreen(message: string) {
  account.value = null; page.value = 'login';
  history.replaceState(null, '', '#login'); notice.value = message; error.value = ''; void focusContent();
}
async function refresh() {
  loading.value = true; error.value = '';
  try { account.value = await client.me(); }
  catch (failure) {
    if (failure instanceof ApiError && failure.status === 401) account.value = null;
    else { account.value = null; error.value = errorMessage(failure); }
  } finally { loading.value = false; void focusContent(); }
}
onMounted(() => { window.addEventListener('hashchange', navigate); void refresh(); });
onBeforeUnmount(() => window.removeEventListener('hashchange', navigate));
</script>

<template>
  <a class="skip-link" href="#contenido">Saltar al contenido</a>
  <div class="site-shell">
    <header class="masthead"><BrandMark /><span class="masthead-note">Compartir. Sorprender. Regalar.</span></header>
    <main id="contenido" ref="heading" tabindex="-1">
      <div v-if="loading" class="loading-state" role="status">Preparando tu espacio…</div>
      <template v-else>
        <div v-if="error" class="alert alert-danger my-4" role="alert">{{ error }} <button class="btn btn-outline-primary ms-2" @click="refresh">Reintentar</button></div>
        <p v-if="notice" role="status" class="alert alert-success my-4">{{ notice }}</p>
        <AccountPanel v-if="account" :account="account" :client="client" @refresh="refresh" @busy="busy = $event"
          @expired="loginScreen('Tu sesión ha caducado. Vuelve a iniciar sesión.')" @logout="loginScreen('Has cerrado sesión.')" />
        <div v-else class="entry-grid">
          <section class="hero" aria-labelledby="hero-title">
            <span class="hero-kicker">LAS MEJORES SORPRESAS SE COMPARTEN</span>
            <div class="hero-art"><img src="/gift.svg" alt="" width="200" height="200"><span aria-hidden="true">✦</span></div>
            <div><h1 id="hero-title">{{ captions }}</h1><p>Organiza tus intercambios de regalos y consulta en privado a quién te toca regalar.</p></div>
          </section>
          <section class="entry-panel" aria-label="Acceso a TocaRegalo">
            <AuthForm :key="page" :page="page" :client="client" @busy="busy = $event" @authenticated="refresh"
              @registered="loginScreen('Cuenta creada. Ya puedes iniciar sesión; verificar el correo es un paso independiente.')"
              @reset="loginScreen('Contraseña actualizada. Inicia sesión con tu nueva contraseña.')" />
          </section>
        </div>
      </template>
    </main>
    <footer class="site-footer"><span>TocaRegalo</span><span>Pequeños detalles, grandes ilusiones.</span></footer>
  </div>
</template>
