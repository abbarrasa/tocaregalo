export type PrivatePage = { kind: 'account' } | { kind: 'groups' } | { kind: 'invitations' } | { kind: 'group'; id: string };
export function privatePage(hash: string): PrivatePage {
  if (hash === '#groups') return { kind: 'groups' };
  if (hash === '#invitations') return { kind: 'invitations' };
  if (hash.startsWith('#groups/')) {
    try { const id = decodeURIComponent(hash.slice(8)); if (id.trim()) return { kind: 'group', id }; }
    catch (failure) { if (!(failure instanceof URIError)) throw failure; }
    return { kind: 'groups' };
  }
  return { kind: 'account' };
}
