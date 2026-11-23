import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App as VueApp } from 'vue';
import App from '../src/App.vue';
import { ApiError, type AuthClient } from '../src/api.ts';
import type { EventClient, GroupEvent } from '../src/event-client.ts';
import type { GroupClient } from '../src/group-client.ts';
import type { Page } from '../src/pagination.ts';
const group = { id: 'g', name: 'Friends', ownerAccountId: 'self', createdAtMs: 1 };
const event: GroupEvent = { id: 'latest', groupId: 'g', createdAtMs: 2000, closureAtMs: null };
const auth: AuthClient = {
  async me() { return { id: 'self', displayName: 'Self', email: 'self@example.test', lastName: null, phone: null, emailVerifiedAtMs: null }; },
  startSocialLogin() {},
  async login() {}, async register() {}, async recover() {}, async reset() {}, async requestVerification() {}, async confirmVerification() {}, async logout() {},
};
function stubs() {
  return { events: {
    list: vi.fn<EventClient['list']>().mockResolvedValue({ items: [event], nextCursor: null }),
    create: vi.fn<EventClient['create']>().mockResolvedValue(event), find: vi.fn<EventClient['find']>().mockResolvedValue(event),
  }, groups: {
    find: vi.fn<GroupClient['find']>().mockResolvedValue(group), list: vi.fn<GroupClient['list']>().mockResolvedValue({ items: [], nextCursor: null }),
    create: vi.fn<GroupClient['create']>(), members: vi.fn<GroupClient['members']>(), removeMember: vi.fn<GroupClient['removeMember']>(),
  } };
}
let app: VueApp | undefined;
async function mount(clients: ReturnType<typeof stubs>) {
  const host = document.createElement('div'); document.body.append(host);
  app = createApp(App, { client: auth, groupClient: clients.groups, eventClient: clients.events, lifecycleClient: {
    async state(eventId: string) { return { eventId, status: 'pending', drawId: null, closedAtMs: null }; },
    async draw(eventId: string) { return { eventId, status: 'ready', drawId: 'draw', closedAtMs: null }; },
    async close(eventId: string) { return { eventId, status: 'closed', drawId: 'draw', closedAtMs: 1000 }; },
  } }); app.mount(host);
  await vi.waitFor(() => expect(document.querySelector('.loading-state')).toBeNull()); await nextTick();
}
function text() { return document.body.textContent ?? ''; }
function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === label); if (!found) throw new Error('Missing button: ' + label); return found;
}
async function submit() { document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await nextTick(); }
async function schedule(value: string) {
  const toggle = document.querySelector('#event-scheduled'); if (!(toggle instanceof HTMLInputElement)) throw new Error('Missing toggle');
  if (!toggle.checked) { toggle.click(); await nextTick(); }
  const input = document.querySelector('#event-closure'); if (!(input instanceof HTMLInputElement)) throw new Error('Missing date');
  input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); await nextTick();
}
async function go(hash: string) { location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')); await nextTick(); }
function deferred<T>() {
  let resolve: (value: T) => void = () => {}; let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
beforeEach(() => { history.replaceState(null, '', '/#groups/g/events'); });
afterEach(() => { app?.unmount(); app = undefined; document.body.replaceChildren(); });
describe('event screens', () => {
  it('lists server order and replaces bounded cursor pages, including empty and restart', async () => {
    const clients = stubs(); clients.events.list.mockResolvedValueOnce({ items: [event, { ...event, id: 'older', createdAtMs: 1000 }], nextCursor: '[1,1000,"older"]' })
      .mockResolvedValueOnce({ items: [], nextCursor: null }); await mount(clients);
    await vi.waitFor(() => expect(text()).toContain('latest'));
    expect([...document.querySelectorAll('h3 .event-id')].map(e => e.textContent)).toEqual(['latest', 'older']);
    button('Siguiente página').click(); await vi.waitFor(() => expect(text()).toContain('No hay eventos en esta página'));
    expect(clients.events.list).toHaveBeenLastCalledWith('g', '[1,1000,"older"]'); expect(text()).not.toContain('latest');
    button('Volver al principio').click(); await vi.waitFor(() => expect(text()).toContain('latest'));
    expect(clients.events.list).toHaveBeenLastCalledWith('g', null);
  });
  it('allows members to read without exposing the owner creation form', async () => {
    const clients = stubs(); clients.groups.find.mockResolvedValue({ ...group, ownerAccountId: 'other' }); await mount(clients);
    await vi.waitFor(() => expect(text()).toContain('latest')); expect(document.querySelector('form')).toBeNull(); expect(clients.events.create).not.toHaveBeenCalled();
  });
  it('creates without a schedule, blocks duplicate submits/navigation and opens the returned event', async () => {
    const clients = stubs(); const pending = deferred<GroupEvent>(); clients.events.create.mockReturnValue(pending.promise); await mount(clients);
    await vi.waitFor(() => expect(document.querySelector('form')).not.toBeNull()); await submit(); await submit();
    expect(clients.events.create).toHaveBeenCalledExactlyOnceWith('g', null);
    await go('#account'); expect(location.hash).toBe('#groups/g/events');
    pending.resolve(event); await vi.waitFor(() => expect(text()).toContain('Detalle del evento'));
    expect(location.hash).toBe('#events/latest'); expect(clients.events.find).toHaveBeenCalledWith('latest');
  });
  it('validates required/past local closure and sends a future instant without creation overrides', async () => {
    const clients = stubs(); await mount(clients); await vi.waitFor(() => expect(document.querySelector('form')).not.toBeNull());
    await schedule(''); await submit(); expect(clients.events.create).not.toHaveBeenCalled(); expect(text()).toContain('fecha y hora local válidas');
    await schedule('2000-01-01T12:30'); await submit(); expect(clients.events.create).not.toHaveBeenCalled();
    const year = new Date().getFullYear() + 2; const value = year + '-07-15T14:30'; await schedule(value); await submit();
    expect(clients.events.create).toHaveBeenCalledExactlyOnceWith('g', new Date(value).getTime());
    expect(document.querySelector('[name="createdAtMs"]')).toBeNull();
  });
  it('explains ambiguous creation, never repeats it and allows a safe list refresh', async () => {
    const clients = stubs(); clients.events.create.mockRejectedValue(new ApiError(0)); await mount(clients);
    await vi.waitFor(() => expect(text()).toContain('latest')); await submit();
    await vi.waitFor(() => expect(text()).toContain('puede haberse procesado')); expect(clients.events.create).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(button('Actualizar eventos').disabled).toBe(false));
    button('Actualizar eventos').click(); await vi.waitFor(() => expect(clients.events.list).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(text()).toContain('latest'));
  });
  it.each([401, 404, 400])('handles creation session/owner/date failures without retry (%s)', async status => {
    const clients = stubs(); clients.events.create.mockRejectedValue(new ApiError(status)); await mount(clients);
    await vi.waitFor(() => expect(document.querySelector('form')).not.toBeNull()); await submit();
    await vi.waitFor(() => expect(text()).toContain(status === 401 ? 'Tu sesión ha caducado' : status === 404 ? 'El grupo no existe o ya no tienes acceso' : 'debe seguir siendo futura'));
    expect(clients.events.create).toHaveBeenCalledTimes(1);
    if (status !== 400) expect(document.querySelector('#event-scheduled')).toBeNull();
  });
  it('fences the previous list read while a creation is pending', async () => {
    const clients = stubs(); const old = deferred<Page<GroupEvent>>(); const pending = deferred<GroupEvent>();
    clients.events.list.mockReturnValueOnce(old.promise); clients.events.create.mockReturnValueOnce(pending.promise); await mount(clients);
    await vi.waitFor(() => expect(document.querySelector('form')).not.toBeNull()); await submit(); old.reject(new ApiError(401));
    await nextTick(); await nextTick(); expect(text()).not.toContain('Tu sesión ha caducado');
    pending.resolve(event); await vi.waitFor(() => expect(text()).toContain('Detalle del evento'));
  });
  it('clears owner content when a current list read loses group access', async () => {
    const clients = stubs(); await mount(clients); await vi.waitFor(() => expect(text()).toContain('latest'));
    clients.events.list.mockRejectedValue(new ApiError(404)); button('Actualizar eventos').click();
    await vi.waitFor(() => expect(text()).toContain('El grupo no existe o ya no tienes acceso'));
    expect(document.querySelector('form')).toBeNull(); expect(text()).not.toContain('Friends'); expect(text()).not.toContain('latest');
  });
  it('distinguishes an authorized empty page from a failed read', async () => {
    const clients = stubs(); clients.events.list.mockRejectedValueOnce(new ApiError(503)).mockResolvedValue({ items: [], nextCursor: null });
    await mount(clients); await vi.waitFor(() => expect(text()).toContain('servicio no está disponible'));
    expect(text()).not.toContain('Todavía no hay eventos'); button('Reintentar').click(); await vi.waitFor(() => expect(text()).toContain('Todavía no hay eventos'));
  });
  it('shows immutable metadata without inferring effective closure from a past scheduled date', async () => {
    history.replaceState(null, '', '/#events/latest'); const clients = stubs(); clients.events.find.mockResolvedValue({ ...event, closureAtMs: 1000 }); await mount(clients);
    await vi.waitFor(() => expect(text()).toContain('Detalle del evento')); expect(text()).toContain('No se puede modificar');
    expect(text()).toContain('no confirma el cierre efectivo'); expect(document.querySelector('input')).toBeNull();
    expect(document.querySelector('a[href="#groups/g/events"]')).not.toBeNull(); expect(clients.events.list).not.toHaveBeenCalled();
  });
  it.each([401, 404])('handles current event-detail access failure (%s)', async status => {
    history.replaceState(null, '', '/#events/latest'); const clients = stubs(); clients.events.find.mockRejectedValue(new ApiError(status)); await mount(clients);
    await vi.waitFor(() => expect(text()).toContain(status === 401 ? 'Tu sesión ha caducado' : 'El evento no existe o ya no tienes acceso'));
    expect(text()).not.toContain('Detalle del evento');
  });
  it('ignores previous list/detail responses and errors after navigation', async () => {
    const clients = stubs(); const old = deferred<Page<GroupEvent>>(); clients.events.list.mockReturnValueOnce(old.promise); await mount(clients);
    await vi.waitFor(() => expect(clients.events.list).toHaveBeenCalled()); await go('#account'); old.reject(new ApiError(401)); await nextTick(); await nextTick();
    expect(text()).not.toContain('Tu sesión ha caducado');
    const detail = deferred<GroupEvent>(); clients.events.find.mockReturnValueOnce(detail.promise); await go('#events/old');
    await vi.waitFor(() => expect(clients.events.find).toHaveBeenCalledWith('old')); await go('#events/latest');
    await vi.waitFor(() => expect(text()).toContain('latest')); detail.resolve({ ...event, id: 'old' }); await nextTick();
    expect(text()).not.toContain('old');
  });
});
