<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ApiError, errorMessage, type Account, type AuthClient } from './api.ts';
import { createClients } from './clients.ts';
import type { GroupClient } from './group-client.ts';
import type { InvitationClient } from './invitation-client.ts';
import AcceptInvitation from './AcceptInvitation.vue';
import { privatePage } from './navigation.ts';
import GroupList from './GroupList.vue';
import GroupDetail from './GroupDetail.vue';
import AuthForm, { type EntryPage } from './AuthForm.vue';
import AccountPanel from './AccountPanel.vue';
import BrandMark from './BrandMark.vue';
const props = defineProps<{ client?: AuthClient; groupClient?: GroupClient; invitationClient?: InvitationClient }>();
const defaults = createClients();
const client = props.client ?? defaults.auth;
const groupClient = props.groupClient ?? defaults.groups;
const invitationClient = props.invitationClient ?? defaults.invitations;
const account = ref<Account | null>(null); const loading = ref(true); const busy = ref(false);
const notice = ref(''); const error = ref(''); const heading = ref<HTMLElement>();
function readPage(): EntryPage {
  const hash = location.hash.slice(1);
  return hash === 'register' || hash === 'recover' || hash === 'reset' ? hash : 'login';
}
const page = ref<EntryPage>(readPage());
const privateRoute = ref(privatePage(location.hash));
let handledHash = location.hash;
const captions = computed(() => page.value === 'register' ? 'Haz sitio a una nueva tradición.' : 'Descubre a quién te toca sorprender.');
async function focusContent() { await nextTick(); heading.value?.focus(); }
function navigate() {
  // A queued hashchange can arrive after replaceState or a previous handler.
  if (location.hash === handledHash) return;
  if (busy.value) {
    const hash = account.value ? privateRoute.value.kind === 'group' ? '#groups/' + encodeURIComponent(privateRoute.value.id)
      : '#' + privateRoute.value.kind : '#' + page.value;
    history.replaceState(null, '', hash); handledHash = hash; return;
  }
  handledHash = location.hash;
  privateRoute.value = privatePage(location.hash);
  page.value = readPage(); error.value = ''; notice.value = ''; void focusContent();
}
function loginScreen(message: string) {
  busy.value = false;
  account.value = null; page.value = 'login';
  privateRoute.value = { kind: 'account' };
  history.replaceState(null, '', '#login'); handledHash = '#login'; notice.value = message; error.value = ''; void focusContent();
}
function acceptedInvitation() {
  busy.value = false; privateRoute.value = { kind: 'groups' };
  history.replaceState(null, '', '#groups'); handledHash = '#groups';
  notice.value = 'Invitación aceptada. Ya puedes consultar el grupo en tu listado.'; void focusContent();
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
        <template v-if="account">
          <nav class="private-nav" aria-label="Menú principal">
            <a href="#groups" :aria-current="privateRoute.kind === 'groups' || privateRoute.kind === 'group' ? 'page' : undefined" :aria-disabled="busy">Grupos</a>
            <a href="#invitations" :aria-current="privateRoute.kind === 'invitations' ? 'page' : undefined" :aria-disabled="busy">Aceptar invitación</a>
            <a href="#account" :aria-current="privateRoute.kind === 'account' ? 'page' : undefined" :aria-disabled="busy">Mi cuenta</a>
          </nav>
          <GroupList v-if="privateRoute.kind === 'groups'" :client="groupClient" :actor-id="account.id" @busy="busy = $event" @expired="loginScreen('Tu sesión ha caducado. Vuelve a iniciar sesión.')" />
          <GroupDetail v-else-if="privateRoute.kind === 'group'" :key="privateRoute.id" :group-id="privateRoute.id" :client="groupClient" :invitation-client="invitationClient" :actor-id="account.id" @busy="busy = $event" @expired="loginScreen('Tu sesión ha caducado. Vuelve a iniciar sesión.')" />
          <AcceptInvitation v-else-if="privateRoute.kind === 'invitations'" :client="invitationClient" :email="account.email" @busy="busy = $event" @accepted="acceptedInvitation" @expired="loginScreen('Tu sesión ha caducado. Vuelve a iniciar sesión.')" />
          <AccountPanel v-else :account="account" :client="client" @refresh="refresh" @busy="busy = $event"
            @expired="loginScreen('Tu sesión ha caducado. Vuelve a iniciar sesión.')" @logout="loginScreen('Has cerrado sesión.')" />
        </template>
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
