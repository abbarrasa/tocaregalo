// Resolve TypeScript from this workspace: Vue tooling needs the TS6 compiler API.
// Backend Node/Worker checks continue to use the root TS7 compiler.
require('vue-tsc').run(require.resolve('typescript/lib/tsc'));
