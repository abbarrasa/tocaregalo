CREATE TABLE social_accounts (
  provider TEXT NOT NULL CHECK (provider IN ('google')),
  subject TEXT NOT NULL CHECK (length(trim(subject)) > 0),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  linked_at_ms INTEGER NOT NULL,
  PRIMARY KEY (provider, subject),
  UNIQUE (provider, account_id)
) STRICT;

CREATE INDEX social_accounts_by_email ON social_accounts(provider, email);

CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'google'),
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL
) STRICT;

CREATE INDEX oauth_states_expiry ON oauth_states(expires_at_ms);
