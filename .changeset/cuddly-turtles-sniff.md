---
"@cerios/xml-poto-codegen": patch
"@cerios/xml-poto": patch
---

Updated dependencies. Pinned `vitest` to `4.0.18` and kept `tsdown`/`typescript` on their previous stable versions (`^0.21.10`/`^6.0.3`) after `0.22.4`/`7.0.2` were found to break the build (missing `--config-loader bundle` support and stray `.d.ts` files emitted into `src`).
