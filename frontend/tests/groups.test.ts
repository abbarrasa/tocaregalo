import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App as VueApp } from 'vue';
import App from '../src/App.vue';
import GroupDetail from '../src/GroupDetail.vue';
import { ApiError, type Account, type AuthClient } from '../src/api.ts';
import type { Group, GroupClient, Member, Page } from '../src/group-client.ts';

const account: Account = { id: 'self', displayName: 'Inés', email: 'self@example.test', lastName: null, phone: null, emailVerifiedAtMs: null };
const own: Group = { id: 'own', name: 'Our friends', ownerAccountId: 'self', createdAtMs: 1000 };
const other: Group = { id: 'other', name: 'Family', ownerAccountId: 'someone', createdAtMs: 2000 };
const members: readonly Member[] = [{ accountId: 'self', displayName: 'Inés', joinedAtMs: 1000, isOwner: true }];
let app: VueApp | undefined;
function stub() {
  return {
    list: vi.fn<GroupClient['list']>().mockResolvedValue({ items: [own, other], nextCursor: null }),
    create: vi.fn<GroupClient['create']>().mockResolvedValue(own), find: vi.fn<GroupClient['find']>().mockResolvedValue(own),
    members: vi.fn<GroupClient['members']>().mockResolvedValue({ items: members, nextCursor: null }),
    removeMember: vi.fn<GroupClient['removeMember']>().mockResolvedValue(undefined),
  };
}
const auth: AuthClient = {
  async me() { return account; }, async login() {}, async register() {}, async recover() {}, async reset() {},
  startSocialLogin() {},
  async requestVerification() {}, async confirmVerification() {},
  async updateProfile() { return { account, passwordChanged: false }; }, async logout() {},
};
async function mount(groups: GroupClient, invitationList = vi.fn().mockResolvedValue({ items: [], nextCursor: null })) {
  const host = document.createElement('div'); document.body.append(host);
  app = createApp(App, { client: auth, groupClient: groups, invitationClient: {
    list: invitationList, async send() {}, async revoke() {}, async accept() {},
  } }); app.mount(host);
  await vi.waitFor(() => expect(document.querySelector('.loading-state')).toBeNull()); await nextTick();
}
function text() { return document.body.textContent ?? ''; }
function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === label);
  if (!found) throw new Error('Missing button: ' + label); return found;
}
async function go(hash: string) { location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')); await nextTick(); }
async function create(name: string) {
  const control = document.querySelector('#group-name');
  if (!(control instanceof HTMLInputElement)) throw new Error('Missing name field');
  control.value = name; control.dispatchEvent(new Event('input', { bubbles: true })); await nextTick();
  document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await nextTick();
}
function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Not initialized'); };
  let reject: (error: unknown) => void = () => { throw new Error('Not initialized'); };
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
beforeEach(() => { history.replaceState(null, '', '/#groups'); });
afterEach(() => { app?.unmount(); app = undefined; document.body.replaceChildren(); });

describe('group screens', () => {
  it('does not expose removal controls to another participant', async () => {
    history.replaceState(null, '', '/#groups/other'); const client = stub(); client.find.mockResolvedValue(other);
    client.members.mockResolvedValue({ items: [{ accountId: 'p', displayName: 'Ana', joinedAtMs: 0, isOwner: false }], nextCursor: null });
    await mount(client); await vi.waitFor(() => expect(text()).toContain('Ana'));
    expect(text()).not.toContain('Retirar'); expect(client.removeMember).not.toHaveBeenCalled();
  });
  it('ignores an obsolete invitation failure after removal refreshes the panel', async () => {
    history.replaceState(null, '', '/#groups/own'); const client = stub(); const old = deferred<{ items: []; nextCursor: null }>();
    const invitationList = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ items: [], nextCursor: null });
    client.members.mockResolvedValueOnce({ items: [{ accountId: 'p', displayName: 'Ana', joinedAtMs: 0, isOwner: false }], nextCursor: null })
      .mockResolvedValue({ items: members, nextCursor: null });
    await mount(client, invitationList); await vi.waitFor(() => expect(text()).toContain('Ana'));
    button('Retirar Ana').click(); await nextTick(); button('Confirmar retirada').click();
    await vi.waitFor(() => expect(invitationList).toHaveBeenCalledTimes(2)); old.reject(new ApiError(401));
    await nextTick(); await nextTick(); expect(text()).toContain('Retirada procesada'); expect(text()).not.toContain('Tu sesión ha caducado');
  });
  it('confirms removal, protects the owner and refreshes members without duplicate submissions', async () => {
    history.replaceState(null, '', '/#groups/own'); const client = stub(); const pending = deferred<void>();
    const person = { accountId: 'person', displayName: 'Ana', joinedAtMs: 2, isOwner: false };
    client.members.mockResolvedValueOnce({ items: [...members, person], nextCursor: null })
      .mockResolvedValue({ items: members, nextCursor: null }); client.removeMember.mockReturnValue(pending.promise);
    const invitationList = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    await mount(client, invitationList); await vi.waitFor(() => expect(text()).toContain('Ana'));
    expect([...document.querySelectorAll('button')].filter(b => b.textContent?.startsWith('Retirar'))).toHaveLength(1);
    button('Retirar Ana').click(); await nextTick(); expect(client.removeMember).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('remove-member-title'); button('Cancelar').click(); await nextTick();
    expect(document.activeElement).toBe(button('Retirar Ana'));
    button('Retirar Ana').click(); await nextTick(); button('Confirmar retirada').click(); button('Confirmar retirada').click();
    await nextTick(); expect(client.removeMember).toHaveBeenCalledExactlyOnceWith('own', 'person');
    expect(document.querySelector('.owner-invitations')).toBeNull();
    pending.resolve(); await vi.waitFor(() => expect(text()).toContain('Retirada procesada'));
    await vi.waitFor(() => expect(document.querySelector('.owner-invitations')).not.toBeNull());
    expect(invitationList).toHaveBeenCalledTimes(2);
    expect(client.members).toHaveBeenLastCalledWith('own', null); expect(text()).not.toContain('Ana');
  });
  it.each([503, 0])('checks state after an ambiguous removal (%s) without repeating DELETE', async status => {
    history.replaceState(null, '', '/#groups/own'); const client = stub();
    client.members.mockResolvedValueOnce({ items: [{ accountId: 'p', displayName: 'Ana', joinedAtMs: 0, isOwner: false }], nextCursor: null })
      .mockResolvedValue({ items: members, nextCursor: null }); client.removeMember.mockRejectedValue(new ApiError(status));
    await mount(client); await vi.waitFor(() => expect(text()).toContain('Ana'));
    button('Retirar Ana').click(); await nextTick(); button('Confirmar retirada').click();
    await vi.waitFor(() => expect(text()).toContain('La retirada puede haberse aplicado'));
    await vi.waitFor(() => expect(client.members).toHaveBeenCalledTimes(2));
    expect(client.removeMember).toHaveBeenCalledTimes(1); expect(text()).not.toContain('Ana');
  });
  it.each([401, 404, 409])('handles removal authorization and owner conflict (%s)', async status => {
    history.replaceState(null, '', '/#groups/own'); const client = stub();
    client.members.mockResolvedValue({ items: [{ accountId: 'p', displayName: 'Ana', joinedAtMs: 0, isOwner: false }], nextCursor: null });
    client.removeMember.mockRejectedValue(new ApiError(status)); await mount(client);
    await vi.waitFor(() => expect(text()).toContain('Ana')); button('Retirar Ana').click(); await nextTick(); button('Confirmar retirada').click();
    await vi.waitFor(() => expect(text()).toContain(status === 401 ? 'Tu sesión ha caducado' : status === 404 ? 'no existe o ya no tienes acceso' : 'El propietario no se puede retirar'));
    if (status !== 409) { expect(text()).not.toContain('Ana'); expect(document.querySelector('.owner-invitations')).toBeNull(); }
  });
  it('ignores a late removal error after the detail unmounts', async () => {
    const client = stub(); const removal = deferred<void>(); const expired = vi.fn();
    client.members.mockResolvedValue({ items: [{ accountId: 'p', displayName: 'Ana', joinedAtMs: 0, isOwner: false }], nextCursor: null });
    client.removeMember.mockReturnValue(removal.promise);
    const host = document.createElement('div'); document.body.append(host);
    app = createApp(GroupDetail, { groupId: 'own', actorId: 'self', client, onExpired: expired,
      invitationClient: { async list() { return { items: [], nextCursor: null }; }, async send() {}, async revoke() {}, async accept() {} } });
    app.mount(host); await vi.waitFor(() => expect(text()).toContain('Ana'));
    button('Retirar Ana').click(); await nextTick(); button('Confirmar retirada').click(); await nextTick();
    app.unmount(); app = undefined; removal.reject(new ApiError(401)); await nextTick(); await nextTick();
    expect(expired).not.toHaveBeenCalled(); expect(client.members).toHaveBeenCalledTimes(1); expect(text()).not.toContain('Ana');
  });
  it('lists owner/member roles, replaces each bounded page and can restart', async () => {
    const client = stub(); client.list.mockResolvedValueOnce({ items: [own, other], nextCursor: 'next' })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    await mount(client); await vi.waitFor(() => expect(text()).toContain('Our friends'));
    expect(text()).toContain('Propietario'); expect(text()).toContain('Participante');
    button('Siguiente página').click(); await vi.waitFor(() => expect(text()).toContain('No hay más grupos'));
    expect(client.list).toHaveBeenLastCalledWith('next'); expect(text()).not.toContain('Our friends');
    button('Volver al principio').click(); await vi.waitFor(() => expect(text()).toContain('Our friends'));
    expect(client.list).toHaveBeenLastCalledWith(null);
  });
  it('distinguishes an empty authorized list from failure and allows retry', async () => {
    const client = stub(); client.list.mockRejectedValueOnce(new ApiError(503)).mockResolvedValueOnce({ items: [], nextCursor: null });
    await mount(client); await vi.waitFor(() => expect(text()).toContain('servicio no está disponible'));
    expect(text()).not.toContain('Todavía no tienes grupos'); button('Reintentar').click();
    await vi.waitFor(() => expect(text()).toContain('Todavía no tienes grupos'));
  });
  it('validates the group name and prevents duplicate creation while opening the returned server group', async () => {
    const client = stub(); const pending = deferred<Group>(); client.create.mockReturnValue(pending.promise);
    await mount(client); await vi.waitFor(() => expect(text()).toContain('Our friends'));
    await create('  '); expect(client.create).not.toHaveBeenCalled(); expect(text()).toContain('entre 1 y 100');
    await create('  Friends  '); await create('  Friends  '); expect(client.create).toHaveBeenCalledTimes(1);
    expect(client.create).toHaveBeenCalledWith('Friends');
    pending.resolve(own); await vi.waitFor(() => expect(client.find).toHaveBeenCalledWith('own'));
    await vi.waitFor(() => expect(text()).toContain('Miembros del grupo'));
    expect(location.hash).toBe('#groups/own');
  });
  it('does not retry a creation automatically after an ambiguous network outcome', async () => {
    const client = stub(); client.create.mockRejectedValue(new ApiError(0)); await mount(client);
    await create('Friends'); await vi.waitFor(() => expect(text()).toContain('puede haberse procesado'));
    expect(client.create).toHaveBeenCalledTimes(1); expect(location.hash).toBe('#groups');
  });
  it('shows minimal member data with pagination and member role without management controls', async () => {
    history.replaceState(null, '', '/#groups/other'); const client = stub(); client.find.mockResolvedValue(other);
    client.members.mockResolvedValueOnce({ items: members, nextCursor: 'next-person' }).mockResolvedValueOnce({ items: [], nextCursor: null });
    await mount(client); await vi.waitFor(() => expect(text()).toContain('Miembros del grupo'));
    expect(text()).toContain('Participante'); expect(text()).toContain('Inés'); expect(text()).toContain('Se incorporó');
    expect(text()).not.toContain(account.email); expect(text()).not.toContain('Eliminar'); expect(text()).not.toContain('Retirar');
    button('Siguiente página').click(); await vi.waitFor(() => expect(text()).toContain('No hay miembros en esta página'));
    expect(client.members).toHaveBeenLastCalledWith('other', 'next-person'); expect(text()).not.toContain('Inés');
  });
  it('hides all group details when membership is revoked during a member-page read', async () => {
    history.replaceState(null, '', '/#groups/own'); const client = stub(); await mount(client);
    await vi.waitFor(() => expect(text()).toContain('Miembros del grupo'));
    client.members.mockRejectedValue(new ApiError(404)); button('Actualizar miembros').click();
    await vi.waitFor(() => expect(text()).toContain('no existe o ya no tienes acceso'));
    expect(text()).not.toContain('Our friends'); expect(text()).not.toContain('Inés');
  });
  it('uses the same unavailable message for missing or inaccessible group details', async () => {
    history.replaceState(null, '', '/#groups/missing'); const client = stub(); client.find.mockRejectedValue(new ApiError(404));
    await mount(client); await vi.waitFor(() => expect(text()).toContain('El grupo no existe o ya no tienes acceso.'));
    expect(client.members).not.toHaveBeenCalled();
  });
  it('ignores a previous list response after moving to account', async () => {
    const client = stub(); const pending = deferred<Page<Group>>(); client.list.mockReturnValue(pending.promise);
    await mount(client); await vi.waitFor(() => expect(client.list).toHaveBeenCalled()); await go('#account');
    pending.resolve({ items: [own], nextCursor: null }); await nextTick();
    expect(text()).toContain(account.email); expect(text()).not.toContain('Our friends');
  });
  it('ignores old group and member responses, including errors, after switching groups', async () => {
    history.replaceState(null, '', '/#groups/own'); const client = stub(); const pending = deferred<Group>();
    client.find.mockReturnValueOnce(pending.promise).mockResolvedValue(other);
    await mount(client); await vi.waitFor(() => expect(client.find).toHaveBeenCalledWith('own')); await go('#groups/other');
    await vi.waitFor(() => expect(text()).toContain('Family')); pending.resolve(own); await nextTick();
    expect(text()).not.toContain('Our friends');
    const oldMembers = deferred<Page<Member>>(); client.members.mockReturnValueOnce(oldMembers.promise);
    button('Actualizar miembros').click(); await nextTick(); await go('#account'); oldMembers.reject(new ApiError(401));
    await nextTick(); await nextTick(); expect(text()).toContain(account.email); expect(text()).not.toContain('sesión ha caducado');
  });
  it('clears group data and returns to login when a current request reports an expired session', async () => {
    const client = stub(); client.list.mockRejectedValue(new ApiError(401)); await mount(client);
    await vi.waitFor(() => expect(text()).toContain('Tu sesión ha caducado'));
    expect(document.querySelector('#password')).not.toBeNull(); expect(text()).not.toContain('Our friends');
  });
});
