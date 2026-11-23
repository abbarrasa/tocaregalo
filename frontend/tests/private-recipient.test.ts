import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App as VueApp } from 'vue';
import App from '../src/App.vue';
import { ApiError, type AuthClient } from '../src/api.ts';
import type { EventLifecycleClient, EventState } from '../src/event-lifecycle-client.ts';
import type { RecipientClient, OwnRecipient } from '../src/recipient-client.ts';
const ready: EventState = { eventId: 'e', status: 'ready', drawId: 'draw', closedAtMs: null };
const assignment: OwnRecipient = { drawId: 'draw', recipient: { accountId: 'person', displayName: 'Ana <privado>' } };
const auth: AuthClient = {
  async me() { return { id: 'self', displayName: 'Self', email: 's@example.test', lastName: null, phone: null, emailVerifiedAtMs: null }; },
  startSocialLogin() {},
  async login() {}, async register() {}, async recover() {}, async reset() {}, async requestVerification() {}, async confirmVerification() {}, async logout() {},
};
function stubs() {
  return {
    recipients: { find: vi.fn<RecipientClient['find']>().mockResolvedValue(assignment) },
    lifecycle: {
      state: vi.fn<EventLifecycleClient['state']>().mockResolvedValue(ready), draw: vi.fn<EventLifecycleClient['draw']>().mockResolvedValue(ready),
      close: vi.fn<EventLifecycleClient['close']>().mockResolvedValue({ ...ready, status: 'closed', closedAtMs: 2000 }),
    },
    groups: {
      async find(id: string) { return { id, name: 'Friends', ownerAccountId: 'self', createdAtMs: 0 }; }, async list() { return { items: [], nextCursor: null }; },
      async create() { return { id: 'g', name: 'Friends', ownerAccountId: 'self', createdAtMs: 0 }; }, async members() { return { items: [], nextCursor: null }; }, async removeMember() {},
    },
  };
}
let app: VueApp | undefined;
async function mount(clients: ReturnType<typeof stubs>) {
  const host = document.createElement('div'); document.body.append(host);
  app = createApp(App, { client: auth, groupClient: clients.groups, recipientClient: clients.recipients, lifecycleClient: clients.lifecycle, eventClient: {
    async find(id: string) { return { id, groupId: 'g', createdAtMs: 1000, closureAtMs: null }; }, async list() { return { items: [], nextCursor: null }; },
    async create() { return { id: 'e', groupId: 'g', createdAtMs: 1000, closureAtMs: null }; },
  } }); app.mount(host); await vi.waitFor(() => expect(text()).toContain('Ver mi destinatario'));
}
function text() { return document.body.textContent ?? ''; }
function button(label: string) {
  const found = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === label); if (!found) throw new Error('Missing button ' + label); return found;
}
async function show() { button('Ver mi destinatario').click(); await vi.waitFor(() => expect(text()).toContain(assignment.recipient.displayName)); }
async function go(hash: string) { location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')); await nextTick(); }
function deferred<T>() {
  let resolve: (value: T) => void = () => {}; let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
beforeEach(() => { history.replaceState(null, '', '/#events/e'); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { app?.unmount(); app = undefined; document.body.replaceChildren(); });
describe('private recipient UI', () => {
  it('requires explicit reveal, escapes the name and keeps assignment data out of URLs/storage', async () => {
    const clients = stubs(); await mount(clients); expect(clients.recipients.find).not.toHaveBeenCalled(); expect(text()).not.toContain(assignment.recipient.displayName);
    await show(); expect(clients.recipients.find).toHaveBeenCalledExactlyOnceWith('e'); expect(document.querySelector('.recipient-name privado')).toBeNull();
    expect(text()).not.toContain('person'); expect(text()).not.toContain('draw'); expect(location.hash).toBe('#events/e');
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
    expect(document.activeElement?.textContent).toContain(assignment.recipient.displayName);
  });
  it('hides the result, restores focus and makes a fresh request on another reveal', async () => {
    const clients = stubs(); await mount(clients); await show(); button('Ocultar destinatario').click(); await nextTick();
    expect(text()).not.toContain(assignment.recipient.displayName); expect(document.activeElement).toBe(button('Ver mi destinatario'));
    await show(); expect(clients.recipients.find).toHaveBeenCalledTimes(2);
  });
  it('suppresses duplicate reads and ignores a response after hiding an in-flight read', async () => {
    const clients = stubs(); const pending = deferred<OwnRecipient>(); clients.recipients.find.mockReturnValue(pending.promise); await mount(clients);
    button('Ver mi destinatario').click(); button('Ver mi destinatario').click(); await nextTick(); expect(clients.recipients.find).toHaveBeenCalledTimes(1);
    button('Ocultar destinatario').click(); await nextTick(); pending.resolve(assignment); await nextTick(); await nextTick(); expect(text()).not.toContain(assignment.recipient.displayName);
  });
  it.each([409, 404, 503, 0])('shows a generic assignment error (%s) without removing accessible event metadata', async status => {
    const clients = stubs(); if (status === 404) clients.lifecycle.state.mockResolvedValue({ ...ready, status: 'closed', closedAtMs: 2000 });
    clients.recipients.find.mockRejectedValue(new ApiError(status)); await mount(clients); button('Ver mi destinatario').click();
    await vi.waitFor(() => expect(text()).toContain(status === 409 ? 'asignación está pendiente' : status === 404 ? 'no está disponible para tu cuenta' : 'No se pudo consultar tu destinatario'));
    expect(text()).toContain('Detalle del evento'); expect(text()).not.toContain(assignment.recipient.displayName); expect(clients.recipients.find).toHaveBeenCalledTimes(1);
  });
  it('clears private UI on a current 401', async () => {
    const clients = stubs(); clients.recipients.find.mockRejectedValue(new ApiError(401)); await mount(clients); button('Ver mi destinatario').click();
    await vi.waitFor(() => expect(text()).toContain('Tu sesión ha caducado')); expect(text()).not.toContain('Detalle del evento'); expect(text()).not.toContain('Mi destinatario');
  });
  it('allows a participant to read their closed snapshot through the own-assignment client', async () => {
    const clients = stubs(); clients.lifecycle.state.mockResolvedValue({ ...ready, status: 'closed', closedAtMs: 2000 });
    clients.groups.find = async id => ({ id, name: 'Friends', ownerAccountId: 'other', createdAtMs: 0 }); await mount(clients); await show();
    expect(text()).toContain('Cierre efectivo'); expect(text()).not.toContain('Cerrar evento'); expect(clients.recipients.find).toHaveBeenCalledExactlyOnceWith('e');
  });
  it('clears the revealed name immediately when lifecycle refresh starts', async () => {
    const clients = stubs(); await mount(clients); await show(); const refresh = deferred<EventState>(); clients.lifecycle.state.mockReturnValueOnce(refresh.promise);
    button('Actualizar estado').click(); await nextTick(); expect(text()).not.toContain(assignment.recipient.displayName); expect(text()).not.toContain('Ver mi destinatario');
    refresh.resolve(ready); await vi.waitFor(() => expect(text()).toContain('Ver mi destinatario')); expect(clients.recipients.find).toHaveBeenCalledTimes(1);
  });
  it.each(['draw', 'close'] as const)('clears a revealed assignment at the start of %s without automatically revealing again', async operation => {
    const clients = stubs(); await mount(clients); await show();
    button(operation === 'draw' ? 'Solicitar sorteo' : 'Cerrar evento').click(); await nextTick(); button(operation === 'draw' ? 'Confirmar sorteo' : 'Confirmar cierre').click();
    await vi.waitFor(() => expect(text()).toContain('Ver mi destinatario')); expect(text()).not.toContain(assignment.recipient.displayName); expect(clients.recipients.find).toHaveBeenCalledTimes(1);
  });
  it('ignores old recipient responses and errors when lifecycle refresh or navigation invalidates the read', async () => {
    const clients = stubs(); const old = deferred<OwnRecipient>(); clients.recipients.find.mockReturnValueOnce(old.promise); await mount(clients);
    button('Ver mi destinatario').click(); await nextTick(); button('Actualizar estado').click(); old.resolve(assignment); await nextTick(); await nextTick();
    expect(text()).not.toContain(assignment.recipient.displayName);
    await vi.waitFor(() => expect(text()).toContain('Ver mi destinatario')); const late = deferred<OwnRecipient>(); clients.recipients.find.mockReturnValueOnce(late.promise);
    button('Ver mi destinatario').click(); await nextTick(); await go('#events/next'); late.reject(new ApiError(401));
    await vi.waitFor(() => expect(text()).toContain('Ver mi destinatario')); expect(text()).not.toContain('Tu sesión ha caducado'); expect(text()).not.toContain(assignment.recipient.displayName);
  });
});
