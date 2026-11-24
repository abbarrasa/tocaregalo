import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App as VueApp } from 'vue';
import App from '../src/App.vue';
import AccountPanel from '../src/AccountPanel.vue';
import type { GroupClient } from '../src/group-client.ts';
import { ApiError, type Account, type AuthClient } from '../src/api.ts';

const account: Account = { id: 'self', displayName: 'Inés', email: 'ines@example.test', lastName: null, phone: null, emailVerifiedAtMs: null };
let app: VueApp | undefined;
function clientStub() {
  return {
    me: vi.fn<AuthClient['me']>().mockRejectedValue(new ApiError(401)),
    startSocialLogin: vi.fn<AuthClient['startSocialLogin']>(),
    login: vi.fn<AuthClient['login']>().mockResolvedValue(undefined),
    register: vi.fn<AuthClient['register']>().mockResolvedValue(undefined),
    recover: vi.fn<AuthClient['recover']>().mockResolvedValue(undefined),
    reset: vi.fn<AuthClient['reset']>().mockResolvedValue(undefined),
    requestVerification: vi.fn<AuthClient['requestVerification']>().mockResolvedValue(undefined),
    confirmVerification: vi.fn<AuthClient['confirmVerification']>().mockResolvedValue(undefined),
    updateProfile: vi.fn<AuthClient['updateProfile']>().mockResolvedValue({ account, passwordChanged: false }),
    logout: vi.fn<AuthClient['logout']>().mockResolvedValue(undefined),
  };
}
function element<T extends HTMLElement>(selector: string, constructor: { new(): T }): T {
  const value = document.querySelector(selector);
  if (!(value instanceof constructor)) throw new Error('Missing test element: ' + selector);
  return value;
}
async function mount(client: AuthClient, groupClient?: GroupClient) {
  const host = document.createElement('div'); document.body.append(host);
  app = createApp(App, { client, groupClient }); app.mount(host);
  await vi.waitFor(() => expect(document.querySelector('.loading-state')).toBeNull()); await nextTick();
}
async function input(id: string, value: string) {
  const control = element('#' + id, HTMLInputElement); control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true })); await nextTick();
}
async function submit() { element('form', HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await nextTick(); }
async function page(hash: string) { location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')); await nextTick(); }
beforeEach(() => { history.replaceState(null, '', '/#login'); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { app?.unmount(); app = undefined; document.body.replaceChildren(); });

describe('authentication screens', () => {
  it('shows an actionable Spanish ownership recovery screen after Google callback', async () => {
    const client = clientStub(); await mount(client);
    await page('#recover-social');
    expect(document.body.textContent).toContain('Recupera la propiedad de tu cuenta');
    expect(document.body.textContent).toContain('verifica el correo');
    expect(document.querySelector('#identifier')).not.toBeNull();
  });
  it('explains that Spanish phones can omit the country prefix', async () => {
    const client = clientStub(); await mount(client);
    expect(document.body.textContent).toContain('612345678');
    expect(document.body.textContent).toContain('+34612345678');
  });
  it('opens and validates the profile editor, including password confirmation', async () => {
    const client = clientStub(); client.me.mockResolvedValue(account); await mount(client);
    const button = [...document.querySelectorAll('button')].find(item => item.textContent === 'Modificar datos');
    button?.click(); await nextTick();
    await input('profile-name', 'Inés Modificada');
    await input('profile-phone', '+34612345678');
    await input('profile-new-password', '123456');
    await input('profile-confirm-password', '654321');
    await input('profile-current-password', 'abcdef');
    const form = [...document.querySelectorAll('form')].find(item => item.textContent?.includes('Guardar datos'));
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.body.textContent).toContain('contraseñas nuevas'));
    expect(client.updateProfile).not.toHaveBeenCalled();
    await input('profile-phone', 'invalid');
    await input('profile-new-password', '');
    await input('profile-confirm-password', '');
    await input('profile-current-password', '');
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.body.textContent).toContain('teléfono internacional'));
    expect(client.updateProfile).not.toHaveBeenCalled();
  });
  it('offers Google only on login and starts its OAuth route through the auth client', async () => {
    const client = clientStub(); await mount(client);
    const google = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Continuar con Google'));
    expect(google).toBeTruthy();
    google?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(client.startSocialLogin).toHaveBeenCalledWith('google');
    await page('#register');
    expect([...document.querySelectorAll('button')].some(item => item.textContent?.includes('Continuar con Google'))).toBe(false);
  });
  it('shows server field errors next to registration inputs', async () => {
    const client = clientStub();
    client.register.mockRejectedValue(new ApiError(400, 'validation_error', {
      email: 'Introduce un correo electrónico válido.',
      password: 'La contraseña debe tener al menos seis caracteres.',
    }));
    await mount(client); await page('#register');
    await input('name', 'Inés'); await input('email', 'invalid');
    await input('password', '123456'); await input('confirm', '123456'); submit();
    await vi.waitFor(() => expect(document.querySelector('#email')?.classList.contains('is-invalid')).toBe(true));
    expect(document.querySelector('#email')?.getAttribute('aria-invalid')).toBe('true');
    expect(document.body.textContent).toContain('correo electrónico válido');
  });
  it('registers without optional fields, preserves six Unicode characters and returns to login without issuing a session', async () => {
    const client = clientStub(); await mount(client); await page('#register');
    expect(element('#phone', HTMLInputElement).required).toBe(false);
    expect(element('#password', HTMLInputElement).hasAttribute('maxlength')).toBe(false);
    await input('name', 'Inés'); await input('email', account.email);
    await input('password', '🔑🔑🔑🔑🔑🔑'); await input('confirm', '🔑🔑🔑🔑🔑🔑'); await submit();
    await vi.waitFor(() => expect(document.body.textContent).toContain('Cuenta creada.'));
    expect(client.register).toHaveBeenCalledWith({ name: 'Inés', email: account.email, password: '🔑🔑🔑🔑🔑🔑' });
    expect(client.login).not.toHaveBeenCalled(); expect(client.me).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#password')?.getAttribute('autocomplete')).toBe('current-password');
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  });
  it('rejects fewer than six Unicode characters and mismatched confirmation before registering', async () => {
    const client = clientStub(); await mount(client); await page('#register');
    await input('password', '🔑🔑🔑🔑🔑'); await input('confirm', '🔑🔑🔑🔑🔑'); await submit();
    await vi.waitFor(() => expect(document.querySelector('[role=alert]')?.textContent).toContain('seis caracteres'));
    expect(document.activeElement?.getAttribute('role')).toBe('alert');
    await input('password', '123456'); await input('confirm', '654321'); await submit();
    await vi.waitFor(() => expect(document.body.textContent).toContain('deben coincidir'));
    expect(client.register).not.toHaveBeenCalled();
  });
  it('prevents duplicate login submission, loads the server account and clears the password form', async () => {
    const client = clientStub(); let complete: (() => void) | undefined;
    client.login.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
    await mount(client); client.me.mockResolvedValue(account);
    await input('identifier', '+34600000101'); await input('password', ' 123456 ');
    await submit(); await submit(); expect(client.login).toHaveBeenCalledTimes(1);
    expect(element('fieldset', HTMLFieldSetElement).disabled).toBe(true);
    expect(client.login).toHaveBeenCalledWith('+34600000101', ' 123456 ');
    complete?.(); await vi.waitFor(() => expect(document.body.textContent).toContain('Mi cuenta'));
    expect(document.querySelector('#password')).toBeNull(); expect(document.body.textContent).toContain(account.email);
  });
  it('shows rate limiting and network failure messages and permits retry', async () => {
    const client = clientStub(); client.login.mockRejectedValueOnce(new ApiError(429)).mockRejectedValueOnce(new ApiError(0));
    await mount(client); await submit();
    await vi.waitFor(() => expect(document.body.textContent).toContain('quince minutos'));
    await submit(); await vi.waitFor(() => expect(document.body.textContent).toContain('conexión'));
    await vi.waitFor(() => expect(element('fieldset', HTMLFieldSetElement).disabled).toBe(false));
  });
  it('requests recovery generically and resets with an explicit code without logging in', async () => {
    const client = clientStub(); await mount(client); await page('#recover');
    await input('identifier', '+34600000101'); await submit();
    await vi.waitFor(() => expect(document.body.textContent).toContain('Si existe una cuenta'));
    expect(client.recover).toHaveBeenCalledWith('+34600000101');
    await page('#reset'); await input('token', ' recovery-code ');
    await input('password', ' secret '); await input('confirm', ' secret '); await submit();
    await vi.waitFor(() => expect(document.body.textContent).toContain('Contraseña actualizada'));
    expect(client.reset).toHaveBeenCalledWith('recovery-code', ' secret '); expect(client.login).not.toHaveBeenCalled();
    expect(location.href).not.toContain('recovery-code');
  });
  it('retains an expired-code error until corrected', async () => {
    const client = clientStub(); client.reset.mockRejectedValue(new ApiError(400));
    await mount(client); await page('#reset'); await input('token', 'bad');
    await input('password', '123456'); await input('confirm', '123456'); await submit();
    await vi.waitFor(() => expect(document.body.textContent).toContain('ha caducado'));
    expect(document.querySelector('#token')).not.toBeNull();
  });
  it('restores account from the session, verifies only its stored email and refreshes the status', async () => {
    const client = clientStub(); client.me.mockResolvedValue(account); await mount(client);
    const button = [...document.querySelectorAll('button')].find(item => item.textContent === 'Solicitar código');
    button?.click(); await vi.waitFor(() => expect(client.requestVerification).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(document.body.textContent).toContain('Solicitud procesada'));
    client.me.mockResolvedValue({ ...account, emailVerifiedAtMs: 1000 });
    await input('verification-token', 'proof-code'); await submit();
    await vi.waitFor(() => expect(document.body.textContent).toContain('Correo verificado'));
    expect(client.confirmVerification).toHaveBeenCalledWith('proof-code'); expect(client.requestVerification.mock.calls[0]).toEqual([]);
  });
  it('unlocks navigation after verification refresh without reloading, including a delayed account read', async () => {
    const client = clientStub(); client.me.mockResolvedValueOnce(account);
    let finishRead: ((value: Account) => void) | undefined;
    client.me.mockImplementationOnce(() => new Promise<Account>(resolve => { finishRead = resolve; }));
    const groups: GroupClient = {
      list: vi.fn<GroupClient['list']>().mockResolvedValue({ items: [], nextCursor: null }),
      create: vi.fn(), find: vi.fn(), members: vi.fn(), removeMember: vi.fn(),
    };
    await mount(client, groups);
    await input('verification-token', 'proof-code'); await submit();
    await vi.waitFor(() => expect(document.querySelector('.loading-state')).not.toBeNull());
    expect(client.confirmVerification).toHaveBeenCalledTimes(1);
    finishRead?.({ ...account, emailVerifiedAtMs: 1000 });
    await vi.waitFor(() => expect(document.body.textContent).toContain('Correo verificado'));
    expect(element('a[href="#groups"]', HTMLAnchorElement).getAttribute('aria-disabled')).toBe('false');
    await page('#groups');
    await vi.waitFor(() => expect(document.body.textContent).toContain('Todavía no tienes grupos'));
    expect(groups.list).toHaveBeenCalledWith(null);
    await page('#account');
    expect(document.body.textContent).toContain('Correo verificado');
    expect(client.me).toHaveBeenCalledTimes(2);
  });
  it('releases account busy on unmount and ignores a late expired response', async () => {
    const client = clientStub(); let fail: ((error: Error) => void) | undefined;
    client.requestVerification.mockImplementation(() => new Promise<void>((_, reject) => { fail = reject; }));
    const onBusy = vi.fn(); const onExpired = vi.fn();
    const host = document.createElement('div'); document.body.append(host);
    app = createApp(AccountPanel, { account, client, onBusy, onExpired }); app.mount(host);
    [...document.querySelectorAll('button')].find(item => item.textContent === 'Solicitar código')?.click();
    await nextTick(); expect(onBusy.mock.calls).toEqual([[true]]);
    app.unmount(); app = undefined;
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
    fail?.(new ApiError(401)); await new Promise(resolve => setTimeout(resolve, 0));
    expect(onExpired).not.toHaveBeenCalled();
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
  });
  it('clears private account content on session expiry and on successful logout', async () => {
    const client = clientStub(); client.me.mockResolvedValue(account); client.requestVerification.mockRejectedValue(new ApiError(401));
    await mount(client);
    [...document.querySelectorAll('button')].find(item => item.textContent === 'Solicitar código')?.click();
    await vi.waitFor(() => expect(document.body.textContent).toContain('Tu sesión ha caducado'));
    expect(document.body.textContent).not.toContain(account.email);
    app?.unmount(); document.body.replaceChildren(); await mount(client);
    [...document.querySelectorAll('button')].find(item => item.textContent === 'Cerrar sesión')?.click();
    await vi.waitFor(() => expect(document.body.textContent).toContain('Has cerrado sesión'));
    expect(document.body.textContent).not.toContain(account.email);
  });
  it('does not treat an unavailable session endpoint as a valid session', async () => {
    const client = clientStub(); client.me.mockRejectedValue(new ApiError(503)); await mount(client);
    expect(document.body.textContent).toContain('servicio no está disponible');
    expect(document.body.textContent).not.toContain(account.email);
    client.me.mockResolvedValue(account); element('.alert button', HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.body.textContent).toContain('Mi cuenta'));
  });
});
