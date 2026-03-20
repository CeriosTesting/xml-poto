# Cerios Monorepo

This repository is now organized as a workspace so additional packages can be added under `packages/`.

## Packages

- [`packages/xml-poto`](packages/xml-poto): TypeScript XML serialization library published as `@cerios/xml-poto`
- [`packages/xml-poto-codegen`](packages/xml-poto-codegen): XSD-to-TypeScript generator published as `@cerios/xml-poto-codegen`

## Development

Run from repository root:

```bash
npm install
npm run build
npm run test
npm run lint
npm run format:check
npm run deps:check
```

Package-focused commands can also be run directly in `packages/xml-poto`.

## Release Checklist

When `@cerios/xml-poto` introduces behavior that `@cerios/xml-poto-codegen` depends on, keep both packages aligned in the same PR:

1. Bump `@cerios/xml-poto` version as needed.
2. Update `packages/xml-poto-codegen/package.json` dependency baselines together:
   - `devDependencies.@cerios/xml-poto` must be an exact version (for repo/CI consistency).
   - `peerDependencies.@cerios/xml-poto` must be a compatible range starting at that same baseline.
3. Add/update a changeset entry. The repo's Changesets fixed group ensures both packages are versioned together.
4. Validate with:
   - `npm run compile`
   - `npm run test`
