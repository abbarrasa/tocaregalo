import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App as VueApp } from 'vue';
import App from '../src/App.vue';
import { ApiError, type Account, type AuthClient } from '../src/api.ts';
import type { GroupClient } from '../src/group-client.ts';
import type { Invitation, InvitationClient } from '../src/invitation-client.ts';
import type { Page } from '../src/pagination.ts';

const account: Account = { id: 'self', email: 'self@example.test', displayName: 'Self', lastName: null, phone: null, emailVerifiedAtMs: null };
const pending: Invitation = { email: 'guest@example.test', createdAtMs: 1, expiresAtMs: 900000, status: 'pending' };
let app: VueApp | undefined;
function clients() {
  const auth: AuthClient = { async me() { return account; }, startSocialLogin() {}, async login() {}, async register() {}, async recover() {}, async reset() {}, async requestVerification() {}, async confirmVerification() {}, async logout() {} };
  const groups = {
    list: vi.fn<GroupClient['list']>().mockResolvedValue({ items: [], nextCursor: null }),
    create: vi.fn<GroupClient['create']>(),
    find: vi.fn<GroupClient['find']>().mockResolvedValue({ id: 'g', name: 'Friends', ownerAccountId: 'self', createdAtMs: 1 }),
    members: vi.fn<GroupClient['members']>().mockResolvedValue({ items: [], nextCursor: null }),
    removeMember: vi.fn<GroupClient['removeMember']>().mockResolvedValue(undefined),
  };
  const invitations = {
    list: vi.fn<InvitationClient['list']>().mockResolvedValue({ items: [pending], nextCursor: null }),
    send: vi.fn<InvitationClient['send']>().mockResolvedValue(undefined),
    revoke: vi.fn<InvitationClient['revoke']>().mockResolvedValue(undefined),
    accept: vi.fn<InvitationClient['accept']>().mockResolvedValue(undefined),
  };
  return { auth, groups, invitations };
}
type Clients = ReturnType<typeof clients>;
async function mount(value: Clients) {
  const host = document.createElement('div'); document.body.append(host);
  app = createApp(App, { client: value.auth, groupClient: value.groups, invitationClient: value.invitations }); app.mount(host);
  await vi.waitFor(() => expect(document.querySelector('.loading-state')).toBeNull()); await nextTick();
}
const text = () => document.body.textContent ?? '';
function button(label: string) {
  const result = [...document.querySelectorAll('button')].find(item => item.textContent?.trim().startsWith(label));
  if (!result) throw new Error('Missing button: ' + label); return result;
}
async function input(id: string, value: string) {
  const field = document.querySelector('#' + id); if (!(field instanceof HTMLInputElement)) throw new Error('Missing field');
  field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); await nextTick();
}
async function submit(id: string) {
  document.querySelector('#' + id)?.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await nextTick();
}
async function go(hash: string) { location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')); await nextTick(); }
function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Not initialized'); };
  let reject: (error: unknown) => void = () => { throw new Error('Not initialized'); };
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
beforeEach(() => { history.replaceState(null, '', '/#groups/g'); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { app?.unmount(); app = undefined; document.body.replaceChildren(); });

describe('invitation screens', () => {
  it('does not render or query invitation administration for a participant', async () => {
    const value = clients(); value.groups.find.mockResolvedValue({ id: 'g', name: 'Friends', ownerAccountId: 'other', createdAtMs: 1 });
    await mount(value); await vi.waitFor(() => expect(text()).toContain('Miembros del grupo'));
    expect(document.querySelector('.owner-invitations')).toBeNull(); expect(value.invitations.list).not.toHaveBeenCalled();
  });
  it('lists all states, pages by email and offers revocation only for pending rows', async () => {
    const value = clients(); value.invitations.list.mockResolvedValueOnce({ items: [pending,
      { ...pending, email: 'accepted@example.test', status: 'accepted' }, { ...pending, email: 'expired@example.test', status: 'expired' }], nextCursor: 'next@example.test' })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    await mount(value); await vi.waitFor(() => expect(text()).toContain(pending.email));
    expect(text()).toContain('Caducada'); expect(text()).toContain('Aceptada');
    expect([...document.querySelectorAll('button')].filter(item => item.textContent?.startsWith('Revocar'))).toHaveLength(1);
    button('Siguiente página').click(); await vi.waitFor(() => expect(text()).toContain('No hay invitaciones en esta página'));
    expect(value.invitations.list).toHaveBeenLastCalledWith('g', 'next@example.test'); expect(text()).not.toContain(pending.email);
  });
  it('validates email, blocks duplicate sends and describes provider acceptance without claiming inbox delivery', async () => {
    const value = clients(); const send = deferred<void>(); value.invitations.send.mockReturnValue(send.promise);
    await mount(value); await vi.waitFor(() => expect(text()).toContain(pending.email));
    await input('invitation-email', 'invalid'); await submit('invitation-email'); expect(value.invitations.send).not.toHaveBeenCalled();
    await input('invitation-email', ' Guest@EXAMPLE.TEST '); await submit('invitation-email'); await submit('invitation-email');
    expect(value.invitations.send).toHaveBeenCalledTimes(1); expect(value.invitations.send).toHaveBeenCalledWith('g', pending.email);
    send.resolve(); await vi.waitFor(() => expect(text()).toContain('no confirma la entrega en el buzón'));
    expect(value.invitations.list).toHaveBeenCalledTimes(2); expect(text()).toContain('sustituye el código anterior');
  });
  it('requires explicit revocation confirmation, restores focus on cancel and refreshes after DELETE', async () => {
    const value = clients(); await mount(value); await vi.waitFor(() => expect(text()).toContain(pending.email));
    button('Revocar').click(); await nextTick(); expect(value.invitations.revoke).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('revoke-title'); button('Cancelar').click(); await nextTick();
    expect(document.activeElement?.textContent).toContain('Revocar'); expect(value.invitations.revoke).not.toHaveBeenCalled();
    button('Revocar').click(); await nextTick(); value.invitations.list.mockResolvedValue({ items: [], nextCursor: null });
    button('Confirmar revocación').click(); await vi.waitFor(() => expect(text()).toContain('Revocación procesada'));
    expect(value.invitations.revoke).toHaveBeenCalledWith('g', pending.email); expect(text()).not.toContain(pending.email);
  });
  it('handles rate limiting and ambiguous send failures without automatic resend', async () => {
    const value = clients(); value.invitations.send.mockRejectedValueOnce(new ApiError(429)).mockRejectedValueOnce(new ApiError(0));
    await mount(value); await input('invitation-email', pending.email); await submit('invitation-email');
    await vi.waitFor(() => expect(text()).toContain('quince minutos')); await nextTick(); await submit('invitation-email');
    await vi.waitFor(() => expect(text()).toContain('puede haberse procesado')); expect(value.invitations.send).toHaveBeenCalledTimes(2);
  });
  it('accepts only an explicit code, clears it and loads a fresh group list without changing account verification', async () => {
    history.replaceState(null, '', '/#invitations'); const value = clients(); await mount(value);
    await input('invitation-code', 'incomplete'); await submit('invitation-code'); expect(value.invitations.accept).not.toHaveBeenCalled();
    const code = 'a'.repeat(64); await input('invitation-code', ' ' + code + ' '); await submit('invitation-code');
    await vi.waitFor(() => expect(text()).toContain('Invitación aceptada.'));
    expect(value.invitations.accept).toHaveBeenCalledWith(code); expect(value.groups.list).toHaveBeenCalledWith(null);
    expect(location.hash).toBe('#groups'); expect(text()).not.toContain(code);
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
    await go('#account'); expect(text()).toContain('Verificación pendiente');
  });
  it('explains expired, consumed and wrong-email codes generically and permits correction', async () => {
    history.replaceState(null, '', '/#invitations'); const value = clients(); value.invitations.accept.mockRejectedValue(new ApiError(400));
    await mount(value); expect(text()).toContain(account.email); expect(text()).toContain('Debe coincidir');
    await input('invitation-code', 'b'.repeat(64)); await submit('invitation-code');
    await vi.waitFor(() => expect(text()).toContain('corresponde a otro correo')); expect(document.querySelector('#invitation-code')).not.toBeNull();
  });
  it('clears the private group when invitation administration loses authorization', async () => {
    const value = clients(); value.invitations.list.mockRejectedValue(new ApiError(404)); await mount(value);
    await vi.waitFor(() => expect(text()).toContain('El grupo no existe o ya no tienes acceso.'));
    expect(document.querySelector('.owner-invitations')).toBeNull(); expect(text()).not.toContain(pending.email);
  });
  it('returns to login on current session expiry while accepting', async () => {
    history.replaceState(null, '', '/#invitations'); const value = clients(); value.invitations.accept.mockRejectedValue(new ApiError(401));
    await mount(value); await input('invitation-code', 'a'.repeat(64)); await submit('invitation-code');
    await vi.waitFor(() => expect(text()).toContain('Tu sesión ha caducado'));
    expect(text()).not.toContain(account.email); expect(document.querySelector('#invitation-code')).toBeNull();
  });
  it('ignores obsolete invitation pages after leaving a group or starting a mutation', async () => {
    const value = clients(); const old = deferred<Page<Invitation>>(); value.invitations.list.mockReturnValueOnce(old.promise);
    await mount(value); await vi.waitFor(() => expect(value.invitations.list).toHaveBeenCalled()); await go('#account');
    old.reject(new ApiError(401)); await nextTick(); await nextTick(); expect(text()).toContain(account.email); expect(text()).not.toContain('sesión ha caducado');
    const stale = deferred<Page<Invitation>>(); value.invitations.list.mockReturnValueOnce(stale.promise).mockResolvedValue({ items: [], nextCursor: null });
    await go('#groups/g'); await vi.waitFor(() => expect(value.invitations.list).toHaveBeenCalledTimes(2));
    await input('invitation-email', pending.email); await submit('invitation-email');
    await vi.waitFor(() => expect(text()).toContain('No hay invitaciones en esta página'));
    stale.resolve({ items: [pending], nextCursor: null }); await nextTick(); await nextTick();
    expect(text()).not.toContain(pending.email);
  });
});
