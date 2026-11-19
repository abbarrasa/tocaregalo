-- Supports group-scoped ID keyset pages without sorting every event in the group.
CREATE INDEX events_by_group_id ON events(group_id, id);
