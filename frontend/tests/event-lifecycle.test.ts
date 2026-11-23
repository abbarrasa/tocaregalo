import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App as VueApp } from 'vue';
import App from '../src/App.vue';
import EventLifecycle from '../src/EventLifecycle.vue';
import { ApiError, type AuthClient } from '../src/api.ts';
import type { EventLifecycleClient, EventState } from '../src/event-lifecycle-client.ts';
import type { GroupClient } from '../src/group-client.ts';
const pending: EventState = { eventId: 'e', status: 'pending', drawId: null, closedAtMs: null };
const ready: EventState = { ...pending, status: 'ready', drawId: 'draw' };
const closed: EventState = { ...ready, status: 'closed', closedAtMs: 2000 };
const group = { id: 'g', name: 'Friends', ownerAccountId: 'self', createdAtMs: 0 };
const auth: AuthClient = {
  async me() { return { id: 'self', displayName: 'Self', email: 's@example.test', lastName: null, phone: null, emailVerifiedAtMs: null }; },
  startSocialLogin() {},
  async login() {}, async register() {}, async recover() {}, async reset() {}, async requestVerification() {}, async confirmVerification() {},
  async updateProfile() { return { account: { id: 'self', displayName: 'Self', email: 's@example.test', lastName: null, phone: null, emailVerifiedAtMs: null }, passwordChanged: false }; }, async logout() {},
};
function stubs() {
  return { lifecycle: {
    state: vi.fn<EventLifecycleClient['state']>().mockResolvedValue(pending), draw: vi.fn<EventLifecycleClient['draw']>().mockResolvedValue(ready),
    close: vi.fn<EventLifecycleClient['close']>().mockResolvedValue(closed),
  }, groups: {
    find: vi.fn<GroupClient['find']>().mockResolvedValue(group), list: vi.fn<GroupClient['list']>().mockResolvedValue({ items: [], nextCursor: null }),
    members: vi.fn<GroupClient['members']>(), create: vi.fn<GroupClient['create']>(), removeMember: vi.fn<GroupClient['removeMember']>(),
  } };
}
let app: VueApp | undefined;
async function mount(clients: ReturnType<typeof stubs>) {
  const host = document.createElement('div'); document.body.append(host);
  app = createApp(App, { client: auth, groupClient: clients.groups, lifecycleClient: clients.lifecycle, eventClient: {
    async find(id: string) { return { id, groupId: 'g', createdAtMs: 1000, closureAtMs: 0 }; }, async list() { return { items: [], nextCursor: null }; },
    async create() { return { id: 'e', groupId: 'g', createdAtMs: 1000, closureAtMs: null }; },
  } }); app.mount(host); await nextTick();
}
function text() { return document.body.textContent ?? ''; }
function button(label: string) {
  const found = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === label); if (!found) throw new Error('Missing button ' + label); return found;
}
async function go(hash: string) { location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')); await nextTick(); }
function deferred<T>() {
  let resolve: (value: T) => void = () => {}; let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
beforeEach(() => { history.replaceState(null, '', '/#events/e'); });
afterEach(() => { app?.unmount(); app = undefined; document.body.replaceChildren(); });
describe('event lifecycle UI', () => {
  it.each([pending, ready, closed])('shows authoritative $status state despite a past schedule', async state => {
    const clients = stubs(); clients.lifecycle.state.mockResolvedValue(state); await mount(clients);
    await vi.waitFor(() => expect(text()).toContain(state.status === 'pending' ? 'Pendiente de sorteo actualizado' : state.status === 'ready' ? 'Sorteo actualizado' : 'Cierre efectivo'));
    expect(text()).not.toContain('draw');
    if (state.status === 'closed') { expect(text()).not.toContain('Solicitar sorteo'); expect(text()).not.toContain('Cerrar evento'); }
  });
  it('shows lifecycle metadata to a participant without owner controls', async () => {
    const clients = stubs(); clients.groups.find.mockResolvedValue({ ...group, ownerAccountId: 'other' }); await mount(clients);
    await vi.waitFor(() => expect(text()).toContain('Pendiente de sorteo actualizado'));
    expect(text()).not.toContain('Solicitar sorteo'); expect(text()).not.toContain('Cerrar evento');
  });
  it('requires draw confirmation, manages focus and blocks duplicate requests/navigation', async () => {
    const clients = stubs(); const operation = deferred<EventState>(); clients.lifecycle.draw.mockReturnValue(operation.promise); await mount(clients);
    await vi.waitFor(() => expect(text()).toContain('Solicitar sorteo')); button('Solicitar sorteo').click(); await nextTick();
    expect(clients.lifecycle.draw).not.toHaveBeenCalled(); expect(document.activeElement?.id).toBe('lifecycle-confirm-title');
    button('Cancelar').click(); await nextTick(); expect(document.activeElement).toBe(button('Solicitar sorteo'));
    button('Solicitar sorteo').click(); await nextTick(); button('Confirmar sorteo').click(); button('Confirmar sorteo').click(); await nextTick();
    expect(clients.lifecycle.draw).toHaveBeenCalledExactlyOnceWith('e'); await go('#account'); expect(location.hash).toBe('#events/e');
    operation.resolve(ready); await vi.waitFor(() => expect(text()).toContain('Sorteo actualizado confirmado')); expect(clients.lifecycle.close).not.toHaveBeenCalled();
  });
  it('confirms early closure, fixes assignments and hides further actions', async () => {
    const clients = stubs(); await mount(clients); await vi.waitFor(() => expect(text()).toContain('Cerrar evento'));
    button('Cerrar evento').click(); await nextTick(); expect(text()).toContain('El cierre no se puede deshacer'); expect(clients.lifecycle.close).not.toHaveBeenCalled();
    button('Confirmar cierre').click(); await vi.waitFor(() => expect(text()).toContain('Cierre confirmado por el servidor'));
    expect(clients.lifecycle.close).toHaveBeenCalledExactlyOnceWith('e'); expect(text()).toContain('Cierre efectivo'); expect(text()).not.toContain('Cerrar evento');
  });
  it.each([409, 503, 0])('reconciles a failed mutation (%s) with GET and never repeats POST', async status => {
    const clients = stubs(); clients.lifecycle.close.mockRejectedValue(new ApiError(status)); clients.lifecycle.state.mockResolvedValueOnce(pending).mockResolvedValue(closed);
    await mount(clients); await vi.waitFor(() => expect(text()).toContain('Cerrar evento')); button('Cerrar evento').click(); await nextTick(); button('Confirmar cierre').click();
    await vi.waitFor(() => expect(text()).toContain('Cierre efectivo')); expect(clients.lifecycle.close).toHaveBeenCalledTimes(1); expect(clients.lifecycle.state).toHaveBeenCalledTimes(2);
    expect(text()).toContain(status === 409 ? 'menos de tres miembros' : 'Puede haberse procesado'); expect(text()).not.toContain('Cierre confirmado por el servidor');
  });
  it('leaves controls unavailable when reconciliation fails and permits explicit read-only refresh', async () => {
    const clients = stubs(); clients.lifecycle.draw.mockRejectedValue(new ApiError(0)); clients.lifecycle.state.mockResolvedValueOnce(pending).mockRejectedValueOnce(new ApiError(503)).mockResolvedValue(ready);
    await mount(clients); await vi.waitFor(() => expect(text()).toContain('Solicitar sorteo')); button('Solicitar sorteo').click(); await nextTick(); button('Confirmar sorteo').click();
    await vi.waitFor(() => expect(text()).toContain('No se pudo consultar el estado actual')); expect(text()).not.toContain('Solicitar sorteo');
    await vi.waitFor(() => expect(button('Actualizar estado').disabled).toBe(false)); button('Actualizar estado').click();
    await vi.waitFor(() => expect(text()).toContain('Sorteo actualizado')); expect(clients.lifecycle.draw).toHaveBeenCalledTimes(1);
  });
  it.each([401, 404])('clears private UI on a current mutation access error (%s)', async status => {
    const clients = stubs(); clients.lifecycle.draw.mockRejectedValue(new ApiError(status)); await mount(clients);
    await vi.waitFor(() => expect(text()).toContain('Solicitar sorteo')); button('Solicitar sorteo').click(); await nextTick(); button('Confirmar sorteo').click();
    await vi.waitFor(() => expect(text()).toContain(status === 401 ? 'Tu sesión ha caducado' : 'El evento no existe o ya no tienes acceso'));
    expect(text()).not.toContain('Detalle del evento'); expect(clients.lifecycle.state).toHaveBeenCalledTimes(1);
  });
  it('revalidates owner visibility while reconciling a conflict', async () => {
    const clients = stubs(); clients.groups.find.mockResolvedValueOnce(group).mockResolvedValue({ ...group, ownerAccountId: 'other' });
    clients.lifecycle.draw.mockRejectedValue(new ApiError(409)); await mount(clients); await vi.waitFor(() => expect(text()).toContain('Solicitar sorteo'));
    button('Solicitar sorteo').click(); await nextTick(); button('Confirmar sorteo').click();
    await vi.waitFor(() => expect(clients.lifecycle.state).toHaveBeenCalledTimes(2)); await nextTick();
    expect(text()).not.toContain('Solicitar sorteo'); expect(text()).not.toContain('Cerrar evento');
  });
  it('ignores obsolete read errors when switching events', async () => {
    const clients = stubs(); const old = deferred<EventState>(); clients.lifecycle.state.mockReturnValueOnce(old.promise).mockResolvedValue({ ...ready, eventId: 'next' });
    await mount(clients); await vi.waitFor(() => expect(clients.lifecycle.state).toHaveBeenCalledWith('e')); await go('#events/next');
    await vi.waitFor(() => expect(text()).toContain('Sorteo actualizado')); old.reject(new ApiError(401)); await nextTick(); await nextTick();
    expect(text()).not.toContain('Tu sesión ha caducado'); expect(text()).toContain('Sorteo actualizado');
  });
  it('ignores a late mutation after unmount', async () => {
    const clients = stubs(); const operation = deferred<EventState>(); clients.lifecycle.draw.mockReturnValue(operation.promise); const expired = vi.fn();
    const host = document.createElement('div'); document.body.append(host);
    app = createApp(EventLifecycle, { eventId: 'e', groupId: 'g', actorId: 'self', groups: clients.groups, client: clients.lifecycle, onExpired: expired }); app.mount(host);
    await vi.waitFor(() => expect(text()).toContain('Solicitar sorteo')); button('Solicitar sorteo').click(); await nextTick(); button('Confirmar sorteo').click(); await nextTick();
    app.unmount(); app = undefined; operation.reject(new ApiError(401)); await nextTick(); await nextTick();
    expect(expired).not.toHaveBeenCalled(); expect(clients.lifecycle.state).toHaveBeenCalledTimes(1);
  });
});
