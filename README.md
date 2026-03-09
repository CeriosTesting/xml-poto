# Cerios Monorepo

This repository is now organized as a workspace so additional packages can be added under `packages/`.

## Packages

- [`packages/xml-poto`](packages/xml-poto): TypeScript XML serialization library published as `@cerios/xml-poto`

## Development

Run from repository root:

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run lint
pnpm run format:check
```

Package-focused commands can also be run directly in `packages/xml-poto`.
