# AGENTS.md

Repository-specific instructions for coding agents. User-level `~/.dsh/AGENTS.md` still applies; where the two differ, this file wins for work inside this repository.

## Project overview

`innenu-generator` is a TypeScript library that turns the inNENU content repository (YAML pages + Markdown sources) into the JSON/Markdown/plain-text artifacts consumed by the WeChat miniapp and the VuePress site.

- Package manager: pnpm `12.18.0` (declared via `devEngines`)
- Runtime: Node.js `>=22.12.0` (supported LTS lines). `devEngines` enforces only this runtime floor, not patched security releases
- Build: tsdown, ESM only, `target: "node22"`, minified with source maps
- Tests: vitest (`__tests__/`)
- Lint/format: oxlint + oxfmt (type-aware rules included)

`pnpm run <script>` refuses to start when the local Node version does not satisfy `devEngines.runtime`; either use a supported Node release or pass `--runtime-on-fail=ignore` for local experiments.

## Layout

```text
src/
├── index.ts                 # root barrel: public API
├── component-schema.ts      # `innenu-generator/schema` entry (component schemas)
├── typings.ts               # shared public types (MarkdownOptions, UrlHandler, ...)
├── config.ts                # module-level generator config (`config()`)
├── utils.ts                 # path/link/style helpers, page-path validation
├── knowledge.ts             # knowledge-page text generation
├── components/<tag>/        # per-component json.ts / markdown.ts / schema.ts
├── generator/               # account, map, music, page indexes, svg icons
├── helpers/                 # file lists, YAML, JSON, OSS, git, svg, validation, queues
├── page/                    # page JSON / Markdown / plain-text pipelines
└── schema/                  # shared zod schemas (account, common, map, music, ...)
scripts/generate-schema.ts   # writes draft-7 JSON schemas into schemas/
```

## Commands

```bash
pnpm install
pnpm run build        # tsdown -> dist/
pnpm run test         # vitest
pnpm run lint         # oxlint --fix && oxfmt
pnpm run lint:check   # CI gate: oxlint + oxfmt --check
pnpm run schema       # regenerate schemas/*.json
pnpm run clean        # remove dist/
```

Before opening a PR, run `pnpm run test`, `pnpm run lint:check`, `pnpm run build`, and `pnpm exec tsc --noEmit` (the last one is a local convenience; CI relies on oxlint's type-aware rules).

## Architecture notes

- `config()` assigns into the module-level `generatorConfig`; generators read it at call time. Tests that call `config()` must restore the defaults afterwards.
- Validation functions (`check*`) return `string[]` (empty = valid) and also log with `console.error`. Generation entry points (`getPageJSON`, generators) collect those issues and throw `ValidationError` (see `src/helpers/validation.ts`) instead of emitting invalid artifacts. Zod messages are localized at formatting time via `formatZodError`, never by changing the global zod locale.
- Component Markdown rendering lives in `src/page/markdown-renderers.ts`; both the site pipeline (`getPageMarkdown`) and the plain-text pipeline (`getPageText`) dispatch through it. Add new components there, not in per-pipeline switches.
- Page JSON output is built explicitly field by field in `src/page/json.ts`; do not spread the raw page config into the output (AI-only fields must not leak).
- Public entry points are `innenu-generator`, `innenu-generator/schema`, and the type-only `innenu-generator/typings`.
- JSON schemas under `schemas/` are generated artifacts and are not committed (`prepublishOnly` regenerates them).

## Conventions

- Keep source comments and user-facing error messages in Chinese, matching the existing code.
- Prefer pure helpers; component JSON generators must not mutate their input.
- New behavior needs a regression test under `__tests__/`; snapshot tests that list whole directories are discouraged — assert targeted paths instead.
