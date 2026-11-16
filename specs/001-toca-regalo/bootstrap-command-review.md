# Bootstrap Command Reference Review

Reference: PHP command supplied by the user during Clarification, 2026-11-16.
Specification: [Spec 001 v1.0](./spec.md), FR-30, Q16.
Status: reference analysis with user-approved adaptation requirements; no implementation or architecture approval.

## Observed behavior

- Command name: `app:user:create-super-admin`; interactive only; noninteractive execution returns invalid status.
- Uses SymfonyStyle, hidden password questions without visible fallback, password confirmation using `hash_equals`, and at most three attempts per question.
- Validates email and password through an external credentials validator. Rejects an existing email without modifying the account.
- Creates a user, marks it verified, hashes its password using `UserPasswordHasherInterface`, and assigns an existing role named `ROLE_SUPER_ADMIN`.
- Fails if that role is absent. Persists and flushes through Doctrine; handles unique-constraint/database exceptions and invalid input, reporting success/failure via console exit codes and messages.
- Uses Nurschool namespaces and dependencies. A typed class constant imposes a PHP syntax constraint to assess when choosing the approved runtime; the reference does not itself select a runtime.

## Original conflicts and approved resolution

1. Required phone and first name from FR-3 are not collected. Determine the bootstrap prompts; optional surnames remain an application field.
2. Password prompt requires at least 12 characters and at most 72 bytes, whereas the application policy currently requires only a minimum of six characters. The external validator's implementation was not provided; its exact behavior cannot be inferred.
3. Role repositories and a persisted role record are reference details, not an approved role-storage architecture. Determine desired bootstrap behavior if the role does not exist.
4. `markVerified()` introduces an account verification concept absent from the approved requirements so far; do not add verification flows merely because the reference calls it.
5. Adapt namespaces, user attributes, and validation to Toca Regalo only through an approved specification and plan. Do not copy dependency classes that were not supplied or invent their implementations during Clarification.

The reference source remains available in conversation history. This review records observed behavior and decisions needed, without importing executable code into the project.

## User-approved adaptation (S11)

- Request required first name and phone, optional surnames, email, and a confirmed password.
- Apply the general application policy: at least six characters; do not import the reference's 12-character minimum or 72-byte prompt as a product requirement.
- Create the SUPER ADMIN role if missing, without selecting a role-storage architecture in this phase.
- Omit `markVerified()` and all account verification concepts or flows.
- Adapt namespaces and field validation to Toca Regalo. Implementation remains subject to the approved plan/tasks and explicit authorization.
