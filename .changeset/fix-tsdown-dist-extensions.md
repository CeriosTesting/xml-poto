---
"@cerios/xml-poto-codegen": patch
"@cerios/xml-poto": patch
---

Fix `package.json` entry points to match tsdown's default output extensions.

After the tsup → tsdown migration, the emitted CJS artifacts are `index.cjs`
and `index.d.cts` (instead of tsup's `index.js` / `index.d.ts`), but the
manifests still referenced the old filenames. As a result `main`, `types`,
and the `require` export condition pointed at files that no longer exist,
which broke CJS consumers and `@arethetypeswrong/cli` resolution.

Updated in both packages:

- `main`: `./dist/index.js` → `./dist/index.cjs`
- `types`: `./dist/index.d.ts` → `./dist/index.d.cts`
- `exports["."].require.default`: `./dist/index.js` → `./dist/index.cjs`
- `exports["."].require.types`: `./dist/index.d.ts` → `./dist/index.d.cts`

In `@cerios/xml-poto-codegen` the `bin` entry was also corrected:

- `bin["xml-poto-codegen"]`: `dist/cli.js` → `dist/cli.cjs`

ESM entry points (`.mjs` / `.d.mts`) were already correct and are unchanged.
