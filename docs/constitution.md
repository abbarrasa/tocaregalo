# Toca Regalo Constitution

Revision: v1
Status: approved
Approval: The user explicitly approved the constitution on 2026-11-16 after revising P6 to require English for technical and governance documents.

- **P1. Technology simplicity.** Use the simplest design that satisfies approved requirements; justify technologies and dependencies and obtain user authorization before installing packages. Verify through plan and dependency review.
- **P2. Requirements as authority.** Implement only specified and approved behavior; consult the user about unspecified decisions and approve changes before implementing them. Verify through traceability between requirements, tasks, code, and validation.
- **P3. Independent domain.** Keep draw rules independent of the interface, persistence, and frameworks. Verify through dependency review and unit tests without external services.
- **P4. Separate responsibilities.** Separate presentation, operation orchestration, and persistence through explicit boundaries, keeping business rules in the domain. Verify through architectural review and tests of component interactions.
- **P5. Verifiable quality.** Cover all approved requirements with checks: domain unit tests, integration tests at existing boundaries, and functional tests of specified flows, including applicable errors and regressions. Verify through a requirements coverage matrix and results; any code coverage threshold requires approval.
- **P6. Language policy.** Use English for code identifiers, comments, technical documentation, and project governance documents, including `docs/`, `specs/`, `AGENTS.md`, and `MEMORY.md`. Use Spanish only for user-facing documentation, such as `README.md`, and application text. Additional localization requires an approved specification. Verify through code, documentation, and UI review.
