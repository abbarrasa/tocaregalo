export type PrivatePage = { kind: 'account' } | { kind: 'groups' } | { kind: 'invitations' } | { kind: 'group'; id: string }
  | { kind: 'events'; groupId: string } | { kind: 'event'; id: string };
export function privateHash(page: PrivatePage): string {
  if (page.kind === 'group') return '#groups/' + encodeURIComponent(page.id);
  if (page.kind === 'event') return '#events/' + encodeURIComponent(page.id);
  if (page.kind === 'events') return '#groups/' + encodeURIComponent(page.groupId) + '/events';
  return '#' + page.kind;
}
export function privatePage(hash: string): PrivatePage {
  if (hash === '#groups') return { kind: 'groups' };
  if (hash === '#invitations') return { kind: 'invitations' };
  const events = /^#groups\/([^/]+)\/events$/.exec(hash);
  const event = /^#events\/([^/]+)$/.exec(hash);
  const match = events ?? event;
  if (match) {
    try {
      const id = decodeURIComponent(match[1]);
      if (id.trim()) return events ? { kind: 'events', groupId: id } : { kind: 'event', id };
    } catch (failure) { if (!(failure instanceof URIError)) throw failure; }
    return { kind: 'groups' };
  }
  if (hash.startsWith('#groups/')) {
    try { const id = decodeURIComponent(hash.slice(8)); if (id.trim()) return { kind: 'group', id }; }
    catch (failure) { if (!(failure instanceof URIError)) throw failure; }
    return { kind: 'groups' };
  }
  return { kind: 'account' };
}
